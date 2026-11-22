const pool = require("../config/db");

class ErrorValidacion extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

function validarId(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
}

function esFechaValida(fecha) {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));

  return comprobacion.getUTCFullYear() === anio
    && comprobacion.getUTCMonth() === mes - 1
    && comprobacion.getUTCDate() === dia;
}

function obtenerUsuarioId(req) {
  const id = Number(req.usuario?.id ?? req.usuario?.id_usuario);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/vacunacion/vacunas
// Devuelve vacunas activas e inactivas para conservar el catálogo histórico.
const obtenerVacunas = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id_vacuna,
        nombre,
        descripcion,
        edad_recomendada,
        numero_dosis,
        estado
      FROM vacunas
      ORDER BY estado DESC, nombre ASC
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error("Error al obtener vacunas:", error);
    return res.status(500).json({ mensaje: "Error al obtener el catálogo de vacunas." });
  }
};

// POST /api/vacunacion/vacunas (solo admin)
const crearVacuna = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const descripcion = String(req.body.descripcion || "").trim() || null;
    const edadRecomendada = String(req.body.edad_recomendada || "").trim() || null;
    const numeroDosis = Number(req.body.numero_dosis);

    if (!nombre) {
      throw new ErrorValidacion("El nombre de la vacuna es obligatorio.");
    }

    if (nombre.length > 100) {
      throw new ErrorValidacion("El nombre no puede superar los 100 caracteres.");
    }

    if (!Number.isInteger(numeroDosis) || numeroDosis < 1) {
      throw new ErrorValidacion("El número de dosis debe ser un entero mayor que cero.");
    }

    const existente = await pool.query(
      `SELECT id_vacuna, estado
       FROM vacunas
       WHERE LOWER(BTRIM(nombre)) = LOWER($1)
       LIMIT 1`,
      [nombre]
    );

    if (existente.rowCount > 0) {
      const mensaje = existente.rows[0].estado
        ? "Ya existe una vacuna con ese nombre."
        : "Ya existe una vacuna desactivada con ese nombre. Puedes reactivarla desde el catálogo.";
      return res.status(409).json({ mensaje, id_vacuna: existente.rows[0].id_vacuna });
    }

    const resultado = await pool.query(
      `INSERT INTO vacunas
        (nombre, descripcion, edad_recomendada, numero_dosis, estado)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id_vacuna, nombre, descripcion, edad_recomendada, numero_dosis, estado`,
      [nombre, descripcion, edadRecomendada, numeroDosis]
    );

    return res.status(201).json({
      mensaje: "Vacuna registrada correctamente.",
      vacuna: resultado.rows[0],
    });
  } catch (error) {
    if (error instanceof ErrorValidacion) {
      return res.status(error.status).json({ mensaje: error.message });
    }

    console.error("Error al registrar vacuna:", error);
    return res.status(500).json({ mensaje: "Error al registrar la vacuna." });
  }
};

// PATCH /api/vacunacion/vacunas/:id/desactivar (solo admin)
const desactivarVacuna = async (req, res) => {
  try {
    if (!validarId(req.params.id)) {
      return res.status(400).json({ mensaje: "Identificador de vacuna no válido." });
    }

    const resultado = await pool.query(
      `UPDATE vacunas
       SET estado = FALSE
       WHERE id_vacuna = $1 AND estado = TRUE
       RETURNING id_vacuna, nombre, estado`,
      [Number(req.params.id)]
    );

    if (resultado.rowCount === 0) {
      const existente = await pool.query(
        "SELECT id_vacuna, estado FROM vacunas WHERE id_vacuna = $1",
        [Number(req.params.id)]
      );

      if (existente.rowCount === 0) {
        return res.status(404).json({ mensaje: "Vacuna no encontrada." });
      }

      return res.status(409).json({ mensaje: "La vacuna ya está desactivada." });
    }

    return res.json({ mensaje: "Vacuna desactivada correctamente.", vacuna: resultado.rows[0] });
  } catch (error) {
    console.error("Error al desactivar vacuna:", error);
    return res.status(500).json({ mensaje: "Error al desactivar la vacuna." });
  }
};

// PATCH /api/vacunacion/vacunas/:id/activar (solo admin)
const activarVacuna = async (req, res) => {
  try {
    if (!validarId(req.params.id)) {
      return res.status(400).json({ mensaje: "Identificador de vacuna no válido." });
    }

    const resultado = await pool.query(
      `UPDATE vacunas
       SET estado = TRUE
       WHERE id_vacuna = $1 AND estado = FALSE
       RETURNING id_vacuna, nombre, estado`,
      [Number(req.params.id)]
    );

    if (resultado.rowCount === 0) {
      const existente = await pool.query(
        "SELECT id_vacuna, estado FROM vacunas WHERE id_vacuna = $1",
        [Number(req.params.id)]
      );

      if (existente.rowCount === 0) {
        return res.status(404).json({ mensaje: "Vacuna no encontrada." });
      }

      return res.status(409).json({ mensaje: "La vacuna ya está activa." });
    }

    return res.json({ mensaje: "Vacuna reactivada correctamente.", vacuna: resultado.rows[0] });
  } catch (error) {
    console.error("Error al reactivar vacuna:", error);
    return res.status(500).json({ mensaje: "Error al reactivar la vacuna." });
  }
};

// POST /api/vacunacion (admin, médico o enfermero)
const registrarVacunacion = async (req, res) => {
  const client = await pool.connect();

  try {
    const idPaciente = Number(req.body.id_paciente);
    const idVacuna = Number(req.body.id_vacuna);
    const dosis = Number(req.body.dosis);
    const fechaAplicacion = String(req.body.fecha_aplicacion || "").trim();
    const fechaProxima = String(req.body.proxima_dosis || "").trim() || null;
    const lote = String(req.body.lote || "").trim() || null;
    const observaciones = String(req.body.observaciones || "").trim() || null;
    const idUsuario = obtenerUsuarioId(req);

    if (!validarId(idPaciente) || !validarId(idVacuna)) {
      throw new ErrorValidacion("Selecciona un paciente y una vacuna válidos.");
    }

    if (!Number.isInteger(dosis) || dosis < 1) {
      throw new ErrorValidacion("La dosis debe ser un número entero mayor que cero.");
    }

    if (!esFechaValida(fechaAplicacion)) {
      throw new ErrorValidacion("La fecha de aplicación no es válida.");
    }

    if (fechaProxima && !esFechaValida(fechaProxima)) {
      throw new ErrorValidacion("La fecha de próxima dosis no es válida.");
    }

    if (fechaProxima && fechaProxima < fechaAplicacion) {
      throw new ErrorValidacion("La próxima dosis no puede ser anterior a la fecha de aplicación.");
    }

    if (lote && lote.length > 100) {
      throw new ErrorValidacion("El lote no puede superar los 100 caracteres.");
    }

    if (observaciones && observaciones.length > 2000) {
      throw new ErrorValidacion("Las observaciones no pueden superar los 2000 caracteres.");
    }

    if (!idUsuario) {
      return res.status(401).json({ mensaje: "No se pudo identificar al usuario que registra la vacunación." });
    }

    await client.query("BEGIN");

    // Bloquea el paciente durante la validación para reducir carreras
    // entre dos intentos simultáneos de registrar la misma dosis.
    const paciente = await client.query(
      `SELECT id_paciente, fecha_nacimiento::date::text AS fecha_nacimiento
       FROM pacientes
       WHERE id_paciente = $1 AND estado = 'activo'
       FOR UPDATE`,
      [idPaciente]
    );

    if (paciente.rowCount === 0) {
      throw new ErrorValidacion("Paciente no encontrado o inactivo.", 404);
    }

    const hoy = await client.query("SELECT (NOW() AT TIME ZONE 'America/Guatemala')::date::text AS hoy");
    const hoyTexto = String(hoy.rows[0].hoy).slice(0, 10);
    const nacimiento = String(paciente.rows[0].fecha_nacimiento).slice(0, 10);

    if (fechaAplicacion > hoyTexto) {
      throw new ErrorValidacion("La fecha de aplicación no puede estar en el futuro.");
    }

    if (fechaAplicacion < nacimiento) {
      throw new ErrorValidacion("La fecha de aplicación no puede ser anterior al nacimiento del paciente.");
    }

    const vacuna = await client.query(
      `SELECT id_vacuna, numero_dosis
       FROM vacunas
       WHERE id_vacuna = $1 AND estado = TRUE`,
      [idVacuna]
    );

    if (vacuna.rowCount === 0) {
      throw new ErrorValidacion("La vacuna no existe o está desactivada.", 404);
    }

    const maxDosis = Number(vacuna.rows[0].numero_dosis);
    if (dosis > maxDosis) {
      throw new ErrorValidacion(`La dosis no puede superar las ${maxDosis} dosis configuradas para esta vacuna.`);
    }

    const duplicada = await client.query(
      `SELECT id_vacunacion
       FROM vacunaciones
       WHERE id_paciente = $1
         AND id_vacuna = $2
         AND dosis = $3
         AND fecha_aplicacion = $4::date
       LIMIT 1`,
      [idPaciente, idVacuna, String(dosis), fechaAplicacion]
    );

    if (duplicada.rowCount > 0) {
      throw new ErrorValidacion("Ya existe un registro de esa vacuna, dosis y fecha para este paciente.", 409);
    }

    const insertado = await client.query(
      `INSERT INTO vacunaciones
        (id_paciente, id_vacuna, id_usuario, dosis,
         fecha_aplicacion, lote, proxima_dosis, observaciones)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7::date, $8)
       RETURNING *`,
      [idPaciente, idVacuna, idUsuario, String(dosis), fechaAplicacion, lote, fechaProxima, observaciones]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      mensaje: "Vacunación registrada correctamente.",
      vacunacion: insertado.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    if (error instanceof ErrorValidacion) {
      return res.status(error.status).json({ mensaje: error.message });
    }

    console.error("Error al registrar vacunación:", error);
    return res.status(500).json({ mensaje: "Error al registrar la vacunación." });
  } finally {
    client.release();
  }
};

// GET /api/vacunacion/paciente/:id
const historialVacunacion = async (req, res) => {
  try {
    if (!validarId(req.params.id)) {
      return res.status(400).json({ mensaje: "Identificador de paciente no válido." });
    }

    const resultado = await pool.query(
      `SELECT
         v.id_vacunacion,
         v.id_paciente,
         v.id_vacuna,
         v.dosis,
         v.fecha_aplicacion,
         v.lote,
         v.proxima_dosis,
         v.observaciones,
         va.nombre AS vacuna,
         va.estado AS vacuna_activa,
         u.nombre AS registrado_por
       FROM vacunaciones v
       INNER JOIN vacunas va ON v.id_vacuna = va.id_vacuna
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       WHERE v.id_paciente = $1
       ORDER BY v.fecha_aplicacion DESC, v.id_vacunacion DESC`,
      [Number(req.params.id)]
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar historial de vacunación:", error);
    return res.status(500).json({ mensaje: "Error al consultar el historial de vacunación." });
  }
};

// GET /api/vacunacion/proximas-dosis
// Incluye dosis próximas y atrasadas, sin conservar como pendiente una cita
// antigua cuando ya existe una aplicación posterior de esa misma vacuna.
const proximasDosis = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        v.id_vacunacion,
        v.id_paciente,
        p.nombres,
        p.apellidos,
        p.fecha_nacimiento,
        va.id_vacuna,
        va.nombre AS vacuna,
        va.estado AS vacuna_activa,
        v.dosis,
        v.proxima_dosis,
        v.lote,
        CASE
          WHEN v.proxima_dosis < (NOW() AT TIME ZONE 'America/Guatemala')::date THEN 'atrasada'
          ELSE 'proxima'
        END AS estado_dosis,
        (v.proxima_dosis - (NOW() AT TIME ZONE 'America/Guatemala')::date) AS dias_restantes
      FROM vacunaciones v
      INNER JOIN pacientes p ON p.id_paciente = v.id_paciente
      INNER JOIN vacunas va ON va.id_vacuna = v.id_vacuna
      WHERE p.estado = 'activo'
        AND v.proxima_dosis IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM vacunaciones v2
          WHERE v2.id_paciente = v.id_paciente
            AND v2.id_vacuna = v.id_vacuna
            AND (
              v2.fecha_aplicacion > v.fecha_aplicacion
              OR (
                v2.fecha_aplicacion = v.fecha_aplicacion
                AND v2.id_vacunacion > v.id_vacunacion
              )
            )
        )
      ORDER BY v.proxima_dosis ASC, p.apellidos ASC, p.nombres ASC
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar dosis pendientes:", error);
    return res.status(500).json({ mensaje: "Error al consultar próximas y atrasadas dosis." });
  }
};

module.exports = {
  obtenerVacunas,
  crearVacuna,
  desactivarVacuna,
  activarVacuna,
  registrarVacunacion,
  historialVacunacion,
  proximasDosis,
};