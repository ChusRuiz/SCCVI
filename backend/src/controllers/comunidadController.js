
const pool = require("../config/db");

// ============================================
// VALIDACIONES
// ============================================

function validarId(id) {
  const numero = Number(id);
  return Number.isInteger(numero) && numero > 0;
}

function validarDatosComunidad(body) {
  const nombre = String(body.nombre || "").trim();
  const ubicacion = String(body.ubicacion || "").trim();

  const familias =
    body.familias_estimadas === undefined
      ? 0
      : Number(body.familias_estimadas);

  if (!nombre || !ubicacion) {
    throw new Error("El nombre y la ubicación son obligatorios");
  }

  if (nombre.length > 120) {
    throw new Error("El nombre no puede superar los 120 caracteres");
  }

  if (
    !Number.isInteger(familias) ||
    familias < 0
  ) {
    throw new Error("El número estimado de familias debe ser un entero mayor o igual a cero");
  }

  return {
    nombre,
    ubicacion,
    familias_estimadas: familias,
  };
}

// ============================================
// LISTAR Y BUSCAR COMUNIDADES
// ============================================

const listarComunidades = async (req, res) => {
  try {
    const {
      buscar = "",
      estado = "todas",
    } = req.query;

    if (!["todas", "activa", "inactiva"].includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado de comunidad no válido",
      });
    }

    const resultado = await pool.query(
      `SELECT
          c.*,

          (
            SELECT COUNT(*)
            FROM pacientes p
            WHERE p.id_comunidad = c.id_comunidad
          )::INTEGER AS total_pacientes,

          (
            SELECT COUNT(*)
            FROM padres_familia pf
            WHERE pf.id_comunidad = c.id_comunidad
          )::INTEGER AS total_padres

       FROM comunidades c

       WHERE ($1 = 'todas' OR c.estado = $1)

       AND (
          c.nombre ILIKE $2
          OR c.ubicacion ILIKE $2
       )

       ORDER BY c.nombre ASC`,
      [
        estado,
        `%${String(buscar).trim()}%`,
      ]
    );

    return res.json(resultado.rows);

  } catch (error) {
    console.error("Error al consultar comunidades:", error);

    return res.status(500).json({
      mensaje: "Error al consultar comunidades",
    });
  }
};

// ============================================
// CONSULTAR COMUNIDAD POR ID
// ============================================

const obtenerComunidad = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de comunidad no válido",
      });
    }

    const resultado = await pool.query(
      `SELECT
          c.*,

          (
            SELECT COUNT(*)
            FROM pacientes p
            WHERE p.id_comunidad = c.id_comunidad
          )::INTEGER AS total_pacientes,

          (
            SELECT COUNT(*)
            FROM padres_familia pf
            WHERE pf.id_comunidad = c.id_comunidad
          )::INTEGER AS total_padres

       FROM comunidades c
       WHERE c.id_comunidad = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Comunidad no encontrada",
      });
    }

    return res.json(resultado.rows[0]);

  } catch (error) {
    console.error("Error al consultar comunidad:", error);

    return res.status(500).json({
      mensaje: "Error al consultar comunidad",
    });
  }
};

// ============================================
// REGISTRAR COMUNIDAD
// ============================================

const crearComunidad = async (req, res) => {
  try {
    const datos = validarDatosComunidad(req.body);

    const resultado = await pool.query(
      `INSERT INTO comunidades (
          nombre,
          ubicacion,
          familias_estimadas
       )
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        datos.nombre,
        datos.ubicacion,
        datos.familias_estimadas,
      ]
    );

    return res.status(201).json({
      mensaje: "Comunidad registrada correctamente",
      comunidad: resultado.rows[0],
    });

  } catch (error) {
    if (error.message.startsWith("El nombre") ||
        error.message.startsWith("La ubicación") ||
        error.message.startsWith("El número")) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Ya existe una comunidad con ese nombre",
      });
    }

    console.error("Error al registrar comunidad:", error);

    return res.status(500).json({
      mensaje: "Error al registrar comunidad",
    });
  }
};

// ============================================
// ACTUALIZAR COMUNIDAD
// ============================================

const actualizarComunidad = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de comunidad no válido",
      });
    }

    const datos = validarDatosComunidad(req.body);

    const estado =
      req.body.estado === undefined
        ? null
        : req.body.estado;

    if (
      estado !== null &&
      !["activa", "inactiva"].includes(estado)
    ) {
      return res.status(400).json({
        mensaje: "Estado de comunidad no válido",
      });
    }

    const resultado = await pool.query(
      `UPDATE comunidades
       SET nombre = $1,
           ubicacion = $2,
           familias_estimadas = $3,
           estado = COALESCE($4, estado)

       WHERE id_comunidad = $5
       RETURNING *`,
      [
        datos.nombre,
        datos.ubicacion,
        datos.familias_estimadas,
        estado,
        id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Comunidad no encontrada",
      });
    }

    return res.json({
      mensaje: "Comunidad actualizada correctamente",
      comunidad: resultado.rows[0],
    });

  } catch (error) {
    if (
      error.message.startsWith("El nombre") ||
      error.message.startsWith("El número")
    ) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Ya existe otra comunidad con ese nombre",
      });
    }

    console.error("Error al actualizar comunidad:", error);

    return res.status(500).json({
      mensaje: "Error al actualizar comunidad",
    });
  }
};

// ============================================
// DESACTIVAR COMUNIDAD
// ============================================

const desactivarComunidad = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de comunidad no válido",
      });
    }

    const resultado = await pool.query(
      `UPDATE comunidades
       SET estado = 'inactiva'
       WHERE id_comunidad = $1
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Comunidad no encontrada",
      });
    }

    return res.json({
      mensaje: "Comunidad desactivada correctamente",
      comunidad: resultado.rows[0],
    });

  } catch (error) {
    console.error("Error al desactivar comunidad:", error);

    return res.status(500).json({
      mensaje: "Error al desactivar comunidad",
    });
  }
};

// ============================================
// REACTIVAR COMUNIDAD
// ============================================

const activarComunidad = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de comunidad no válido",
      });
    }

    const resultado = await pool.query(
      `UPDATE comunidades
       SET estado = 'activa'
       WHERE id_comunidad = $1
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Comunidad no encontrada",
      });
    }

    return res.json({
      mensaje: "Comunidad reactivada correctamente",
      comunidad: resultado.rows[0],
    });

  } catch (error) {
    console.error("Error al reactivar comunidad:", error);

    return res.status(500).json({
      mensaje: "Error al reactivar comunidad",
    });
  }
};

// ============================================
// EXPORTAR FUNCIONES
// ============================================

module.exports = {
  crearComunidad,
  listarComunidades,
  obtenerComunidad,
  actualizarComunidad,
  desactivarComunidad,
  activarComunidad,
};
