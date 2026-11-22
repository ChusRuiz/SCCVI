const crypto = require("crypto");
const pool = require("../config/db");

const EXPIRACION_MINUTOS = 10;
const COOLDOWN_SEGUNDOS = 30;

function validarId(id) {
  const numero = Number(id);
  return Number.isInteger(numero) && numero > 0;
}

function obtenerUsuarioId(req) {
  return req.usuario?.id || req.usuario?.id_usuario || null;
}

function crearHash(valor) {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

function obtenerNombreBot() {
  return String(process.env.TELEGRAM_BOT_USERNAME || "")
    .trim()
    .replace(/^@/, "");
}

const obtenerEstadoTelegram = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({ success: false, mensaje: "Identificador de padre no válido." });
    }

    const resultado = await pool.query(
      `SELECT
          pf.id_padre,
          pf.nombres,
          pf.apellidos,
          pf.estado AS estado_padre,
          (pf.telegram_chat_id IS NOT NULL AND BTRIM(pf.telegram_chat_id) <> '') AS vinculado,
          vt.telegram_username,
          vt.telegram_nombre,
          vt.usado_en AS vinculado_en
       FROM padres_familia pf
       LEFT JOIN LATERAL (
          SELECT telegram_username, telegram_nombre, usado_en
          FROM vinculaciones_telegram
          WHERE id_padre = pf.id_padre
            AND estado = 'vinculado'
          ORDER BY usado_en DESC NULLS LAST, id_vinculacion DESC
          LIMIT 1
       ) vt ON TRUE
       WHERE pf.id_padre = $1`,
      [Number(id)]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({ success: false, mensaje: "Padre de familia no encontrado." });
    }

    const padre = resultado.rows[0];
    return res.json({
      success: true,
      padre: {
        id_padre: padre.id_padre,
        nombre: `${padre.nombres} ${padre.apellidos}`,
        estado: padre.estado_padre,
        vinculado: padre.vinculado,
        telegram_username: padre.telegram_username || null,
        telegram_nombre: padre.telegram_nombre || null,
        vinculado_en: padre.vinculado_en || null,
      },
    });
  } catch (error) {
    console.error("Error consultando estado de Telegram:", error.message);
    return res.status(500).json({ success: false, mensaje: "No se pudo consultar el estado de Telegram." });
  }
};

const crearEnlaceTelegram = async (req, res) => {
  let client;
  let transaccion = false;

  try {
    client = await pool.connect();
    const { id } = req.params;
    if (!validarId(id)) {
      return res.status(400).json({ success: false, mensaje: "Identificador de padre no válido." });
    }

    const botUsername = obtenerNombreBot();
    if (!/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) {
      return res.status(500).json({
        success: false,
        mensaje: "Configura TELEGRAM_BOT_USERNAME en backend/.env (sin @).",
      });
    }

    await client.query("BEGIN");
    transaccion = true;

    const padreResult = await client.query(
      `SELECT id_padre, nombres, apellidos, estado, telegram_chat_id
       FROM padres_familia
       WHERE id_padre = $1
       FOR UPDATE`,
      [Number(id)]
    );

    if (!padreResult.rows.length) {
      await client.query("ROLLBACK");
      transaccion = false;
      return res.status(404).json({ success: false, mensaje: "Padre de familia no encontrado." });
    }

    const padre = padreResult.rows[0];
    if (padre.estado !== "activo") {
      await client.query("ROLLBACK");
      transaccion = false;
      return res.status(400).json({ success: false, mensaje: "No puedes vincular Telegram a un padre inactivo." });
    }

    if (padre.telegram_chat_id && String(padre.telegram_chat_id).trim()) {
      await client.query("ROLLBACK");
      transaccion = false;
      return res.status(409).json({
        success: false,
        mensaje: "Este padre ya tiene una cuenta de Telegram vinculada. Desvincúlala antes de reemplazarla.",
      });
    }

    const reciente = await client.query(
      `SELECT id_vinculacion
       FROM vinculaciones_telegram
       WHERE id_padre = $1
         AND creado_en > NOW() - ($2 * INTERVAL '1 second')
       ORDER BY creado_en DESC
       LIMIT 1`,
      [Number(id), COOLDOWN_SEGUNDOS]
    );

    if (reciente.rows.length) {
      await client.query("ROLLBACK");
      transaccion = false;
      return res.status(429).json({
        success: false,
        mensaje: `Espera ${COOLDOWN_SEGUNDOS} segundos antes de generar otro enlace.`,
      });
    }

    // Invalida cualquier enlace anterior aún pendiente.
    await client.query(
      `UPDATE vinculaciones_telegram
       SET estado = CASE WHEN expira_en <= NOW() THEN 'expirado' ELSE 'revocado' END,
           actualizado_en = NOW()
       WHERE id_padre = $1 AND estado = 'pendiente'`,
      [Number(id)]
    );

    // 24 bytes aleatorios -> token hexadecimal de 48 caracteres (formato /start permitido por Telegram).
    const codigo = crypto.randomBytes(24).toString("hex");
    const codigoHash = crearHash(codigo);
    const creadoPor = obtenerUsuarioId(req);

    const insert = await client.query(
      `INSERT INTO vinculaciones_telegram (
          id_padre, codigo_hash, creado_por, expira_en
       )
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))
       RETURNING id_vinculacion, creado_en, expira_en`,
      [Number(id), codigoHash, creadoPor, EXPIRACION_MINUTOS]
    );

    await client.query("COMMIT");
    transaccion = false;

    const deepLink = `https://t.me/${botUsername}?start=${codigo}`;

    return res.status(201).json({
      success: true,
      mensaje: "Enlace de vinculación generado. Compártelo únicamente con el padre correspondiente.",
      vinculacion: {
        id_vinculacion: insert.rows[0].id_vinculacion,
        enlace: deepLink,
        expira_en: insert.rows[0].expira_en,
        minutos_validez: EXPIRACION_MINUTOS,
      },
    });
  } catch (error) {
    if (transaccion) await client.query("ROLLBACK");
    console.error("Error generando enlace Telegram:", error.message);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el enlace de vinculación." });
  } finally {
    if (client) client.release();
  }
};

const desvincularTelegram = async (req, res) => {
  let client;
  let transaccion = false;

  try {
    client = await pool.connect();
    const { id } = req.params;
    if (!validarId(id)) {
      return res.status(400).json({ success: false, mensaje: "Identificador de padre no válido." });
    }

    await client.query("BEGIN");
    transaccion = true;

    const resultado = await client.query(
      `UPDATE padres_familia
       SET telegram_chat_id = NULL,
           canal_preferido = CASE WHEN canal_preferido = 'telegram' THEN 'email' ELSE canal_preferido END
       WHERE id_padre = $1
       RETURNING id_padre`,
      [Number(id)]
    );

    if (!resultado.rows.length) {
      await client.query("ROLLBACK");
      transaccion = false;
      return res.status(404).json({ success: false, mensaje: "Padre de familia no encontrado." });
    }

    await client.query(
      `UPDATE vinculaciones_telegram
       SET estado = 'revocado', actualizado_en = NOW()
       WHERE id_padre = $1 AND estado IN ('pendiente', 'vinculado')`,
      [Number(id)]
    );

    await client.query("COMMIT");
    transaccion = false;

    return res.json({ success: true, mensaje: "Cuenta de Telegram desvinculada correctamente." });
  } catch (error) {
    if (transaccion) await client.query("ROLLBACK");
    console.error("Error desvinculando Telegram:", error.message);
    return res.status(500).json({ success: false, mensaje: "No se pudo desvincular Telegram." });
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  obtenerEstadoTelegram,
  crearEnlaceTelegram,
  desvincularTelegram,
  crearHash,
};
