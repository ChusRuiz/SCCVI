const pool = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

function esIdValido(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
}

function responderErrorPublico(res, status = 401) {
  res.set("Cache-Control", "no-store");
  return res.status(status).json({
    success: false,
    mensaje: "No fue posible validar el carnet y el PIN. Verifica los datos o inténtalo más tarde.",
  });
}

// Generar o renovar el carnet QR de un paciente.
// El PIN se recibe en claro solo para generar su hash; nunca se almacena ni se devuelve.
const generarCarnet = async (req, res) => {
  const idPaciente = Number(req.params.id);
  const pin = String(req.body?.pin || "").trim();

  if (!esIdValido(idPaciente)) {
    return res.status(400).json({ success: false, mensaje: "Identificador de paciente no válido." });
  }

  if (!/^\d{6,12}$/.test(pin)) {
    return res.status(400).json({
      success: false,
      mensaje: "El PIN debe contener entre 6 y 12 dígitos numéricos.",
    });
  }

  let client;

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const pinHash = await bcrypt.hash(pin, 12);

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const urlPublica = `${frontendUrl}/carnet/${token}`;
    const qrDataUrl = await QRCode.toDataURL(urlPublica, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 360,
      margin: 2,
    });

    client = await pool.connect();
    await client.query("BEGIN");

    const paciente = await client.query(
      `SELECT id_paciente, nombres, apellidos
       FROM pacientes
       WHERE id_paciente = $1 AND estado = 'activo'
       FOR UPDATE`,
      [idPaciente]
    );

    if (!paciente.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        mensaje: "Paciente no encontrado o inactivo.",
      });
    }

    // Al renovar, revoca el carnet anterior antes de insertar el nuevo.
    await client.query(
      `UPDATE carnets_qr
       SET estado = 'revocado', actualizado_en = NOW()
       WHERE id_paciente = $1 AND estado = 'activo'`,
      [idPaciente]
    );

    const insertado = await client.query(
      `INSERT INTO carnets_qr (
         id_paciente,
         token_hash,
         pin_hash,
         estado,
         intentos_fallidos,
         bloqueado_hasta,
         id_usuario_creador
       )
       VALUES ($1, $2, $3, 'activo', 0, NULL, $4)
       RETURNING id_carnet, creado_en, estado`,
      [idPaciente, tokenHash, pinHash, req.usuario?.id || null]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      mensaje: "Carnet QR generado correctamente.",
      carnet: {
        ...insertado.rows[0],
        paciente: paciente.rows[0],
        url_publica: urlPublica,
        qr: qrDataUrl,
      },
      aviso_seguridad: "El PIN no se almacena en texto claro. Entrégalo al padre o tutor por un medio seguro.",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // La transacción puede haberse confirmado ya.
      }
    }

    console.error("Error al generar carnet QR:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el carnet QR." });
  } finally {
    if (client) client.release();
  }
};

// Consultar el estado del carnet de un paciente sin revelar token ni PIN.
const obtenerCarnetPaciente = async (req, res) => {
  const idPaciente = Number(req.params.id);

  if (!esIdValido(idPaciente)) {
    return res.status(400).json({ success: false, mensaje: "Identificador de paciente no válido." });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         id_carnet,
         id_paciente,
         estado,
         intentos_fallidos,
         bloqueado_hasta,
         fecha_expiracion,
         ultimo_acceso,
         creado_en,
         actualizado_en
       FROM carnets_qr
       WHERE id_paciente = $1
       ORDER BY creado_en DESC
       LIMIT 1`,
      [idPaciente]
    );

    return res.json({
      success: true,
      carnet: resultado.rows[0] || null,
    });
  } catch (error) {
    console.error("Error al consultar carnet QR:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo consultar el carnet." });
  }
};

// Revocar un carnet activo. La revocación no elimina el historial.
const revocarCarnet = async (req, res) => {
  const idCarnet = Number(req.params.id);

  if (!esIdValido(idCarnet)) {
    return res.status(400).json({ success: false, mensaje: "Identificador de carnet no válido." });
  }

  try {
    const resultado = await pool.query(
      `UPDATE carnets_qr
       SET estado = 'revocado', actualizado_en = NOW()
       WHERE id_carnet = $1 AND estado = 'activo'
       RETURNING id_carnet, id_paciente, estado, actualizado_en`,
      [idCarnet]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({ success: false, mensaje: "No se encontró un carnet activo con ese identificador." });
    }

    return res.json({
      success: true,
      mensaje: "Carnet revocado correctamente.",
      carnet: resultado.rows[0],
    });
  } catch (error) {
    console.error("Error al revocar carnet QR:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo revocar el carnet." });
  }
};

// Acceso público protegido por token QR + PIN.
const accederCarnet = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const token = String(req.body?.token || "").trim();
  const pin = String(req.body?.pin || "").trim();

  if (!/^[a-f0-9]{64}$/i.test(token) || !/^\d{6,12}$/.test(pin)) {
    return responderErrorPublico(res, 400);
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resultado = await client.query(
      `SELECT
         c.id_carnet,
         c.id_paciente,
         c.pin_hash,
         c.estado AS estado_carnet,
         c.intentos_fallidos,
         c.bloqueado_hasta,
         c.fecha_expiracion,
         p.nombres,
         p.apellidos,
         p.fecha_nacimiento,
         p.sexo,
         p.estado AS estado_paciente,
         co.nombre AS comunidad
       FROM carnets_qr c
       INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
       LEFT JOIN comunidades co ON co.id_comunidad = p.id_comunidad
       WHERE c.token_hash = $1
       FOR UPDATE OF c`,
      [tokenHash]
    );

    if (!resultado.rowCount) {
      await client.query("ROLLBACK");
      return responderErrorPublico(res);
    }

    const carnet = resultado.rows[0];

    if (carnet.estado_carnet !== "activo" || carnet.estado_paciente !== "activo") {
      await client.query("ROLLBACK");
      return responderErrorPublico(res);
    }

    if (carnet.fecha_expiracion && new Date(carnet.fecha_expiracion) <= new Date()) {
      await client.query(
        `UPDATE carnets_qr
         SET estado = 'expirado', actualizado_en = NOW()
         WHERE id_carnet = $1`,
        [carnet.id_carnet]
      );
      await client.query("COMMIT");
      return responderErrorPublico(res);
    }

    if (carnet.bloqueado_hasta && new Date(carnet.bloqueado_hasta) > new Date()) {
      await client.query("COMMIT");
      return responderErrorPublico(res, 429);
    }

    // Si terminó el bloqueo temporal, se reinicia el contador.
    if (carnet.bloqueado_hasta && new Date(carnet.bloqueado_hasta) <= new Date()) {
      carnet.intentos_fallidos = 0;
      await client.query(
        `UPDATE carnets_qr
         SET intentos_fallidos = 0, bloqueado_hasta = NULL
         WHERE id_carnet = $1`,
        [carnet.id_carnet]
      );
    }

    const pinValido = await bcrypt.compare(pin, carnet.pin_hash);

    if (!pinValido) {
      const intentos = Number(carnet.intentos_fallidos || 0) + 1;
      const bloquea = intentos >= MAX_INTENTOS;

      await client.query(
        `UPDATE carnets_qr
         SET
           intentos_fallidos = $2,
           bloqueado_hasta = CASE
             WHEN $3 THEN NOW() + ($4 * INTERVAL '1 minute')
             ELSE NULL
           END,
           actualizado_en = NOW()
         WHERE id_carnet = $1`,
        [carnet.id_carnet, intentos, bloquea, MINUTOS_BLOQUEO]
      );

      await client.query("COMMIT");
      return responderErrorPublico(res, bloquea ? 429 : 401);
    }

    const [vacunas, controles] = await Promise.all([
      client.query(
        `SELECT
           v.id_vacunacion,
           va.nombre AS vacuna,
           v.dosis,
           v.fecha_aplicacion,
           v.proxima_dosis,
           v.lote
         FROM vacunaciones v
         INNER JOIN vacunas va ON va.id_vacuna = v.id_vacuna
         WHERE v.id_paciente = $1
         ORDER BY v.fecha_aplicacion DESC, v.id_vacunacion DESC
         LIMIT 30`,
        [carnet.id_paciente]
      ),
      client.query(
        `SELECT
           fecha_control,
           peso_kg,
           talla_cm,
           perimetro_cefalico_cm
         FROM controles_crecimiento
         WHERE id_paciente = $1
         ORDER BY fecha_control DESC, id_control DESC
         LIMIT 5`,
        [carnet.id_paciente]
      ),
    ]);

    await client.query(
      `UPDATE carnets_qr
       SET
         intentos_fallidos = 0,
         bloqueado_hasta = NULL,
         ultimo_acceso = NOW(),
         actualizado_en = NOW()
       WHERE id_carnet = $1`,
      [carnet.id_carnet]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      paciente: {
        nombres: carnet.nombres,
        apellidos: carnet.apellidos,
        fecha_nacimiento: carnet.fecha_nacimiento,
        sexo: carnet.sexo,
        comunidad: carnet.comunidad,
      },
      vacunaciones: vacunas.rows,
      controles_crecimiento: controles.rows,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Sin acción adicional.
    }

    console.error("Error al validar acceso al carnet:", error);
    return res.status(500).json({
      success: false,
      mensaje: "No se pudo consultar el carnet en este momento.",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  generarCarnet,
  obtenerCarnetPaciente,
  revocarCarnet,
  accederCarnet,
};
