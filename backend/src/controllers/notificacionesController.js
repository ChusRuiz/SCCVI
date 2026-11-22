const pool = require("../config/db");

// Listar notificaciones provenientes de alertas o campañas.
const listarNotificaciones = async (req, res) => {
  try {
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 100);
    const offset = (pagina - 1) * limite;

    const estadosPermitidos = ["pendiente", "procesando", "enviada", "error"];
    const canalesPermitidos = ["email", "telegram"];

    const estado = estadosPermitidos.includes(req.query.estado) ? req.query.estado : null;
    const canal = canalesPermitidos.includes(req.query.canal) ? req.query.canal : null;
    const busqueda = req.query.busqueda?.trim() || null;

    const filtros = [estado, canal, busqueda];
    const where = `
      WHERE ($1::VARCHAR IS NULL OR n.estado = $1)
        AND ($2::VARCHAR IS NULL OR n.canal = $2)
        AND (
          $3::TEXT IS NULL
          OR pf.nombres ILIKE '%' || $3 || '%'
          OR pf.apellidos ILIKE '%' || $3 || '%'
          OR n.destinatario ILIKE '%' || $3 || '%'
          OR n.asunto ILIKE '%' || $3 || '%'
          OR p.nombres ILIKE '%' || $3 || '%'
          OR p.apellidos ILIKE '%' || $3 || '%'
          OR c.titulo ILIKE '%' || $3 || '%'
        )
    `;

    const joins = `
      FROM notificaciones n
      INNER JOIN padres_familia pf ON pf.id_padre = n.id_padre
      LEFT JOIN alertas a ON a.id_alerta = n.id_alerta
      LEFT JOIN pacientes p ON p.id_paciente = a.id_paciente
      LEFT JOIN campanas c ON c.id_campana = n.id_campana
    `;

    const consulta = await pool.query(
      `
        SELECT
          n.id_notificacion,
          n.id_alerta,
          n.id_campana,
          n.id_padre,
          n.canal,
          n.destinatario,
          n.estado,
          n.asunto,
          n.mensaje,
          n.intentos,
          n.max_intentos,
          n.error_detalle,
          n.fecha_programada,
          n.ultimo_intento_en,
          n.enviado_en,
          n.creado_en,
          pf.nombres || ' ' || pf.apellidos AS padre,
          CASE
            WHEN c.id_campana IS NOT NULL THEN c.titulo
            WHEN p.id_paciente IS NOT NULL THEN p.nombres || ' ' || p.apellidos
            ELSE NULL
          END AS referencia,
          p.nombres || ' ' || p.apellidos AS paciente,
          a.tipo_alerta,
          c.titulo AS campana,
          CASE WHEN c.id_campana IS NOT NULL THEN 'campana' ELSE 'alerta' END AS origen
        ${joins}
        ${where}
        ORDER BY n.creado_en DESC
        LIMIT $4 OFFSET $5
      `,
      [...filtros, limite, offset]
    );

    const conteo = await pool.query(
      `SELECT COUNT(*) AS total ${joins} ${where}`,
      filtros
    );
    const total = Number(conteo.rows[0].total);

    return res.json({
      success: true,
      data: consulta.rows,
      paginacion: {
        pagina,
        limite,
        total,
        total_paginas: Math.ceil(total / limite),
      },
    });
  } catch (error) {
    console.error("Error listando notificaciones:", error);
    return res.status(500).json({ success: false, mensaje: "Error al obtener las notificaciones." });
  }
};

const obtenerEstadisticasNotificaciones = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'procesando') AS procesando,
        COUNT(*) FILTER (WHERE estado = 'enviada') AS enviadas,
        COUNT(*) FILTER (WHERE estado = 'error') AS errores,
        COUNT(*) FILTER (WHERE canal = 'telegram') AS telegram,
        COUNT(*) FILTER (WHERE canal = 'email') AS email,
        COUNT(*) FILTER (WHERE id_campana IS NOT NULL) AS campañas,
        COUNT(*) FILTER (WHERE id_alerta IS NOT NULL) AS alertas
      FROM notificaciones
    `);

    const datos = resultado.rows[0];
    return res.json({
      success: true,
      estadisticas: Object.fromEntries(
        Object.entries(datos).map(([clave, valor]) => [clave, Number(valor)])
      ),
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    return res.status(500).json({ success: false, mensaje: "Error al obtener estadísticas." });
  }
};

const obtenerNotificacion = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, mensaje: "Identificador no válido." });
    }

    const resultado = await pool.query(
      `
        SELECT
          n.*,
          pf.nombres || ' ' || pf.apellidos AS padre,
          p.nombres || ' ' || p.apellidos AS paciente,
          a.tipo_alerta,
          c.titulo AS campana,
          CASE WHEN c.id_campana IS NOT NULL THEN 'campana' ELSE 'alerta' END AS origen
        FROM notificaciones n
        INNER JOIN padres_familia pf ON pf.id_padre = n.id_padre
        LEFT JOIN alertas a ON a.id_alerta = n.id_alerta
        LEFT JOIN pacientes p ON p.id_paciente = a.id_paciente
        LEFT JOIN campanas c ON c.id_campana = n.id_campana
        WHERE n.id_notificacion = $1
      `,
      [id]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({ success: false, mensaje: "Notificación no encontrada." });
    }

    return res.json({ success: true, data: resultado.rows[0] });
  } catch (error) {
    console.error("Error obteniendo notificación:", error);
    return res.status(500).json({ success: false, mensaje: "Error al obtener la notificación." });
  }
};

module.exports = {
  listarNotificaciones,
  obtenerEstadisticasNotificaciones,
  obtenerNotificacion,
};