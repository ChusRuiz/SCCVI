
const pool = require("../config/db");
const { generarAlertas } = require("../services/generadorAlertas");

// ============================================
// VALIDACIONES
// ============================================

const ESTADOS = [
  "pendiente",
  "revisada",
  "resuelta",
  "descartada",
];

const PRIORIDADES = ["preventiva", "critica"];

const TIPOS = [
  "crecimiento_bajo",
  "crecimiento_alto",
  "control_atrasado",
  "vacuna_pendiente",
  "vacuna_atrasada",
];

function validarId(id) {
  const numero = Number(id);
  return Number.isInteger(numero) && numero > 0;
}

function obtenerUsuarioId(req) {
  return req.usuario?.id || req.usuario?.id_usuario || null;
}

// ============================================
// CONSTRUIR FILTROS
// ============================================

function construirFiltros(query) {
  const condiciones = [];
  const valores = [];

  const agregar = (condicion, valor) => {
    valores.push(valor);
    condiciones.push(
      condicion.replace("?", `$${valores.length}`)
    );
  };

  if (query.estado && query.estado !== "todas") {
    if (!ESTADOS.includes(query.estado)) {
      throw new Error("Estado de alerta no válido");
    }

    agregar("a.estado = ?", query.estado);
  }

  if (query.prioridad && query.prioridad !== "todas") {
    if (!PRIORIDADES.includes(query.prioridad)) {
      throw new Error("Prioridad no válida");
    }

    agregar("a.prioridad = ?", query.prioridad);
  }

  if (query.tipo && query.tipo !== "todos") {
    if (!TIPOS.includes(query.tipo)) {
      throw new Error("Tipo de alerta no válido");
    }

    agregar("a.tipo_alerta = ?", query.tipo);
  }

  if (query.id_paciente) {
    if (!validarId(query.id_paciente)) {
      throw new Error("Identificador de paciente no válido");
    }

    agregar("a.id_paciente = ?", Number(query.id_paciente));
  }

  if (query.id_comunidad) {
    if (!validarId(query.id_comunidad)) {
      throw new Error("Identificador de comunidad no válido");
    }

    agregar("p.id_comunidad = ?", Number(query.id_comunidad));
  }

  if (query.buscar) {
    valores.push(`%${String(query.buscar).trim()}%`);

    condiciones.push(
      `(a.titulo ILIKE $${valores.length}
        OR a.descripcion ILIKE $${valores.length}
        OR p.nombres ILIKE $${valores.length}
        OR p.apellidos ILIKE $${valores.length})`
    );
  }

  return {
    where: condiciones.length
      ? condiciones.join(" AND ")
      : "TRUE",
    valores,
  };
}

// ============================================
// LISTAR ALERTAS
// GET /api/alertas
// ============================================

const listarAlertas = async (req, res) => {
  try {
    const {
      pagina = 1,
      limite = 20,
    } = req.query;

    const numeroPagina = Number(pagina);
    const cantidad = Number(limite);

    if (
      !Number.isInteger(numeroPagina) ||
      numeroPagina < 1 ||
      !Number.isInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > 100
    ) {
      return res.status(400).json({
        mensaje: "Los parámetros de paginación no son válidos",
      });
    }

    const filtros = construirFiltros(req.query);

    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM alertas a
       INNER JOIN pacientes p
          ON p.id_paciente = a.id_paciente
       WHERE ${filtros.where}`,
      filtros.valores
    );

    const total = Number(totalResult.rows[0].total);

    const offset = (numeroPagina - 1) * cantidad;

    const valores = [
      ...filtros.valores,
      cantidad,
      offset,
    ];

    const resultado = await pool.query(
      `SELECT
          a.*,

          p.nombres AS paciente_nombres,
          p.apellidos AS paciente_apellidos,
          p.fecha_nacimiento,
          p.sexo,

          c.nombre AS comunidad_nombre

       FROM alertas a

       INNER JOIN pacientes p
          ON p.id_paciente = a.id_paciente

       LEFT JOIN comunidades c
          ON c.id_comunidad = p.id_comunidad

       WHERE ${filtros.where}

       ORDER BY
          CASE a.prioridad
            WHEN 'critica' THEN 1
            ELSE 2
          END,
          CASE a.estado
            WHEN 'pendiente' THEN 1
            WHEN 'revisada' THEN 2
            WHEN 'resuelta' THEN 3
            ELSE 4
          END,
          a.fecha_deteccion DESC

       LIMIT $${valores.length - 1}
       OFFSET $${valores.length}`,
      valores
    );

    return res.json({
      mensaje: "Alertas consultadas correctamente",
      paginacion: {
        total,
        pagina: numeroPagina,
        limite: cantidad,
        total_paginas: Math.ceil(total / cantidad),
      },
      alertas: resultado.rows,
    });

  } catch (error) {
    if (error.message.includes("no válido")) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }

    console.error("Error al listar alertas:", error);

    return res.status(500).json({
      mensaje: "Error al consultar las alertas",
    });
  }
};

// ============================================
// ESTADISTICAS
// GET /api/alertas/estadisticas
// ============================================

const obtenerEstadisticas = async (req, res) => {
  try {
    const filtros = construirFiltros(req.query);

    const resumen = await pool.query(
      `SELECT
          COUNT(*)::INTEGER AS total,

          COUNT(*) FILTER (
            WHERE a.estado = 'pendiente'
          )::INTEGER AS pendientes,

          COUNT(*) FILTER (
            WHERE a.estado = 'revisada'
          )::INTEGER AS revisadas,

          COUNT(*) FILTER (
            WHERE a.estado = 'resuelta'
          )::INTEGER AS resueltas,

          COUNT(*) FILTER (
            WHERE a.estado = 'descartada'
          )::INTEGER AS descartadas,

          COUNT(*) FILTER (
            WHERE a.prioridad = 'preventiva'
          )::INTEGER AS preventivas,

          COUNT(*) FILTER (
            WHERE a.prioridad = 'critica'
          )::INTEGER AS criticas

       FROM alertas a

       INNER JOIN pacientes p
          ON p.id_paciente = a.id_paciente

       WHERE ${filtros.where}`,
      filtros.valores
    );

    const porTipo = await pool.query(
      `SELECT
          a.tipo_alerta,
          COUNT(*)::INTEGER AS total

       FROM alertas a

       INNER JOIN pacientes p
          ON p.id_paciente = a.id_paciente

       WHERE ${filtros.where}

       GROUP BY a.tipo_alerta
       ORDER BY total DESC`,
      filtros.valores
    );

    return res.json({
      mensaje: "Estadísticas de alertas consultadas",
      estadisticas: resumen.rows[0],
      por_tipo: porTipo.rows,
    });

  } catch (error) {
    if (error.message.includes("no válido")) {
      return res.status(400).json({
        mensaje: error.message,
      });
    }

    console.error("Error en estadísticas:", error);

    return res.status(500).json({
      mensaje: "Error al obtener estadísticas de alertas",
    });
  }
};

// ============================================
// CONSULTAR ALERTA INDIVIDUAL
// GET /api/alertas/:id
// ============================================

const obtenerAlerta = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de alerta no válido",
      });
    }

    const resultado = await pool.query(
      `SELECT
          a.*,

          p.nombres AS paciente_nombres,
          p.apellidos AS paciente_apellidos,
          p.fecha_nacimiento,
          p.sexo,
          p.telefono_encargado,
          p.nombre_encargado,

          c.nombre AS comunidad_nombre,
          c.ubicacion AS comunidad_ubicacion

       FROM alertas a

       INNER JOIN pacientes p
          ON p.id_paciente = a.id_paciente

       LEFT JOIN comunidades c
          ON c.id_comunidad = p.id_comunidad

       WHERE a.id_alerta = $1`,
      [id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        mensaje: "Alerta no encontrada",
      });
    }

    return res.json({
      mensaje: "Alerta consultada correctamente",
      alerta: resultado.rows[0],
    });

  } catch (error) {
    console.error("Error al consultar alerta:", error);

    return res.status(500).json({
      mensaje: "Error al consultar la alerta",
    });
  }
};

// ============================================
// CAMBIAR ESTADO DE ALERTA
// ============================================


async function cambiarEstadoAlerta(req, res, nuevoEstado) {
  const { id } = req.params;

  if (!validarId(id)) {
    return res.status(400).json({
      mensaje: "Identificador de alerta no válido",
    });
  }

  try {
    const usuarioId = obtenerUsuarioId(req);

    const estadosPermitidos =
      nuevoEstado === "revisada"
        ? ["pendiente"]
        : ["pendiente", "revisada"];

    const resultado = await pool.query(
      `UPDATE alertas
       SET
          estado = $1::VARCHAR(15),

          fecha_revision = CASE
            WHEN $1::VARCHAR(15) IN (
              'revisada',
              'resuelta',
              'descartada'
            )
            THEN COALESCE(fecha_revision, NOW())
            ELSE fecha_revision
          END,

          id_usuario_revisor = COALESCE(
            $2::INTEGER,
            id_usuario_revisor
          ),

          fecha_resolucion = CASE
            WHEN $1::VARCHAR(15) IN (
              'resuelta',
              'descartada'
            )
            THEN NOW()
            ELSE fecha_resolucion
          END,

          actualizado_en = NOW()

       WHERE id_alerta = $3::INTEGER
         AND estado = ANY($4::VARCHAR(15)[])

       RETURNING *`,
      [
        nuevoEstado,
        usuarioId,
        Number(id),
        estadosPermitidos,
      ]
    );

    if (!resultado.rows.length) {
      const actual = await pool.query(
        `SELECT id_alerta, estado
         FROM alertas
         WHERE id_alerta = $1`,
        [Number(id)]
      );

      if (!actual.rows.length) {
        return res.status(404).json({
          mensaje: "Alerta no encontrada",
        });
      }

      return res.status(409).json({
        mensaje:
          `No se puede cambiar una alerta con estado "${actual.rows[0].estado}" a "${nuevoEstado}"`,
        estado_actual: actual.rows[0].estado,
      });
    }

    return res.json({
      mensaje: `Alerta ${nuevoEstado} correctamente`,
      alerta: resultado.rows[0],
    });

  } catch (error) {
    console.error("Error al cambiar estado:", error);

    return res.status(500).json({
      mensaje: "No se pudo actualizar el estado de la alerta",
      detalle: error.message,
    });
  }
}


// ============================================
// MARCAR COMO REVISADA
// PATCH /api/alertas/:id/revisar
// ============================================

const revisarAlerta = (req, res) =>
  cambiarEstadoAlerta(req, res, "revisada");

// ============================================
// MARCAR COMO RESUELTA
// PATCH /api/alertas/:id/resolver
// ============================================

const resolverAlerta = (req, res) =>
  cambiarEstadoAlerta(req, res, "resuelta");

// ============================================
// DESCARTAR ALERTA
// PATCH /api/alertas/:id/descartar
// ============================================

const descartarAlerta = (req, res) =>
  cambiarEstadoAlerta(req, res, "descartada");

// ============================================
// GENERAR ALERTAS MANUALMENTE
// POST /api/alertas/generar
// ============================================

const generarAlertasManual = async (req, res) => {
  try {
    const resultado = await generarAlertas();

    return res.json(resultado);

  } catch (error) {
    console.error("Error al generar alertas:", error);

    return res.status(500).json({
      mensaje: "No se pudieron generar las alertas",
      detalle: error.message,
    });
  }
};

// ============================================
// EXPORTACIONES
// ============================================

module.exports = {
  listarAlertas,
  obtenerEstadisticas,
  obtenerAlerta,
  revisarAlerta,
  resolverAlerta,
  descartarAlerta,
  generarAlertasManual,
};
