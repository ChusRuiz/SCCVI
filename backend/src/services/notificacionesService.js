const pool = require("../config/db");

const generarNotificacionesDesdeAlertas = async () => {
  const conexion = await pool.connect();

  const resultado = {
    alertas_procesadas: 0,
    notificaciones_creadas: 0,
    duplicadas: 0,
    sin_contacto_principal: 0,
    sin_destinatario: 0,
    canal_no_soportado: 0
  };

  try {
    await conexion.query("BEGIN");

    // Obtener alertas pendientes y su padre de contacto principal.
    const consulta = await conexion.query(`
      SELECT
        a.id_alerta,
        a.tipo_alerta,
        p.id_paciente,

        pf.id_padre,
        pf.nombres,
        pf.apellidos,
        pf.correo,
        pf.telegram_chat_id,
        pf.canal_preferido

      FROM alertas a

      INNER JOIN pacientes p
        ON p.id_paciente = a.id_paciente

      LEFT JOIN LATERAL (
        SELECT
          pf.id_padre,
          pf.nombres,
          pf.apellidos,
          pf.correo,
          pf.telegram_chat_id,
          pf.canal_preferido

        FROM padres_pacientes pp

        INNER JOIN padres_familia pf
          ON pf.id_padre = pp.id_padre

        WHERE pp.id_paciente = p.id_paciente
          AND pp.es_contacto_principal = TRUE
          AND pf.estado = 'activo'

        LIMIT 1
      ) pf ON TRUE

      WHERE a.estado = 'pendiente'
        AND p.estado = 'activo'

      ORDER BY a.fecha_deteccion DESC
    `);

    resultado.alertas_procesadas = consulta.rows.length;

    for (const alerta of consulta.rows) {

      // Verificar que exista un padre principal.
      if (!alerta.id_padre) {
        resultado.sin_contacto_principal++;
        continue;
      }

      const canal = String(
        alerta.canal_preferido || ""
      ).trim().toLowerCase();

      let destinatario = null;

      if (canal === "telegram") {
        destinatario = alerta.telegram_chat_id;
      } else if (canal === "email" || canal === "correo") {
        destinatario = alerta.correo;
      } else {
        resultado.canal_no_soportado++;
        continue;
      }

      if (!destinatario) {
        resultado.sin_destinatario++;
        continue;
      }

      // Mensaje general para proteger información clínica.
      const mensaje =
        `Hola ${alerta.nombres}. El centro de salud tiene ` +
        `una notificación de seguimiento pendiente para su familia. ` +
        `Por favor, comuníquese con el centro de salud para recibir ` +
        `más información. Por seguridad, no incluimos información ` +
        `médica por este medio.`;

      const asunto = "Aviso de seguimiento - SCCVI";

      const insercion = await conexion.query(
        `
          INSERT INTO notificaciones (
            id_alerta,
            id_padre,
            canal,
            destinatario,
            estado,
            asunto,
            mensaje
          )
          VALUES ($1, $2, $3, $4, 'pendiente', $5, $6)

          ON CONFLICT (id_alerta, id_padre, canal)
          DO NOTHING

          RETURNING id_notificacion
        `,
        [
          alerta.id_alerta,
          alerta.id_padre,
          canal === "correo" ? "email" : canal,
          String(destinatario),
          asunto,
          mensaje
        ]
      );

      if (insercion.rowCount > 0) {
        resultado.notificaciones_creadas++;
      } else {
        resultado.duplicadas++;
      }
    }

    await conexion.query("COMMIT");

    return resultado;

  } catch (error) {
    await conexion.query("ROLLBACK");
    throw error;

  } finally {
    conexion.release();
  }
};

module.exports = {
  generarNotificacionesDesdeAlertas
};