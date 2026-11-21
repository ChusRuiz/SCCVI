const db = require("../config/db");

const obtenerDashboard = async (req, res) => {
  try {
    const pacientes = await db.query(
      "SELECT COUNT(*) AS total FROM pacientes WHERE estado = 'activo'"
    );

    const controles = await db.query(
      "SELECT COUNT(*) AS total FROM controles_crecimiento"
    );

    const vacunaciones = await db.query(
      "SELECT COUNT(*) AS total FROM vacunaciones"
    );

    const pendientes = await db.query(
        `SELECT COUNT(*) AS total
        FROM vacunaciones
        WHERE proxima_dosis IS NOT NULL
        AND proxima_dosis >= CURRENT_DATE`
    );

    const recientes = await db.query(
      `SELECT id_paciente, nombres, apellidos, fecha_nacimiento, creado_en
       FROM pacientes
       WHERE estado = 'activo'
       ORDER BY creado_en DESC
       LIMIT 5`
    );

    res.json({
      estadisticas: {
        pacientes_activos: Number(pacientes.rows[0].total),
        controles_crecimiento: Number(controles.rows[0].total),
        vacunaciones_aplicadas: Number(vacunaciones.rows[0].total),
        dosis_pendientes: Number(pendientes.rows[0].total),
      },
      pacientes_recientes: recientes.rows,
    });
  } catch (error) {
    console.error("Error en dashboard:", error.message);

    res.status(500).json({
      mensaje: "Error al obtener estadísticas del dashboard",
    });
  }
};

module.exports = { obtenerDashboard };