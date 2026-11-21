const pool = require("../config/db");

const {
  enviarMensajeTelegram
} = require("./telegramService");

const {
  enviarCorreo
} = require("./emailService");

// Recuperar notificaciones interrumpidas.
async function recuperarNotificacionesAtascadas(client) {
  await client.query(`
    UPDATE notificaciones
    SET
      estado = CASE
        WHEN intentos >= max_intentos THEN 'error'
        ELSE 'pendiente'
      END,

      fecha_programada = CASE
        WHEN intentos >= max_intentos THEN fecha_programada
        ELSE NOW() + INTERVAL '2 minutes'
      END,

      procesando_en = NULL,
      error_detalle = 'Proceso interrumpido. Se recuperó para reintento.',
      actualizado_en = NOW()

    WHERE estado = 'procesando'
      AND procesando_en < NOW() - INTERVAL '10 minutes'
  `);
}

// Reservar la siguiente notificación.
async function obtenerSiguienteNotificacion() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await recuperarNotificacionesAtascadas(client);

    const consulta = await client.query(`
      SELECT *
      FROM notificaciones
      WHERE estado = 'pendiente'
        AND canal IN ('telegram', 'email')
        AND fecha_programada <= NOW()
        AND intentos < max_intentos

      ORDER BY fecha_programada ASC, id_notificacion ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (consulta.rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }

    const notificacion = consulta.rows[0];

    const actualizacion = await client.query(`
      UPDATE notificaciones
      SET
        estado = 'procesando',
        intentos = intentos + 1,
        ultimo_intento_en = NOW(),
        procesando_en = NOW(),
        actualizado_en = NOW()

      WHERE id_notificacion = $1
      RETURNING *
    `, [notificacion.id_notificacion]);

    await client.query("COMMIT");

    return actualizacion.rows[0];

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}

// Enviar según el canal configurado.
async function enviarNotificacion(notificacion) {

  if (notificacion.canal === "telegram") {
    return await enviarMensajeTelegram(
      notificacion.destinatario,
      notificacion.mensaje
    );
  }

  if (notificacion.canal === "email") {
    return await enviarCorreo({
      to: notificacion.destinatario,
      subject: notificacion.asunto || "Notificación SCCVI",
      text: notificacion.mensaje
    });
  }

  throw new Error("Canal de notificación no soportado.");
}

// Procesar una notificación.
async function procesarSiguienteNotificacion() {
  const notificacion = await obtenerSiguienteNotificacion();

  if (!notificacion) {
    return { procesada: false };
  }

  try {
    await enviarNotificacion(notificacion);

    await pool.query(`
      UPDATE notificaciones
      SET
        estado = 'enviada',
        enviado_en = NOW(),
        procesando_en = NULL,
        error_detalle = NULL,
        actualizado_en = NOW()

      WHERE id_notificacion = $1
    `, [notificacion.id_notificacion]);

    console.log(
      `Notificación ${notificacion.id_notificacion} enviada por ${notificacion.canal}.`
    );

    return {
      procesada: true,
      id: notificacion.id_notificacion,
      estado: "enviada"
    };

  } catch (error) {

    const actualizacion = await pool.query(`
      UPDATE notificaciones
      SET
        estado = CASE
          WHEN intentos >= max_intentos THEN 'error'
          ELSE 'pendiente'
        END,

        fecha_programada = CASE
          WHEN intentos >= max_intentos THEN fecha_programada
          ELSE NOW() +
            (GREATEST(2, LEAST(60, intentos * 5)) * INTERVAL '1 minute')
        END,

        procesando_en = NULL,
        error_detalle = LEFT($2, 2000),
        actualizado_en = NOW()

      WHERE id_notificacion = $1

      RETURNING estado, intentos
    `, [
      notificacion.id_notificacion,
      error.message
    ]);

    const estado = actualizacion.rows[0]?.estado || "error";

    console.error(
      `Error en notificación ${notificacion.id_notificacion}:`,
      error.message
    );

    return {
      procesada: true,
      id: notificacion.id_notificacion,
      estado
    };
  }
}

// Procesar una cantidad limitada de notificaciones.
async function procesarColaNotificaciones(maximo = 20) {
  const limite = Math.max(
    1,
    Math.min(Number(maximo) || 20, 100)
  );

  const resultado = {
    procesadas: 0,
    enviadas: 0,
    pendientes_reintento: 0,
    errores: 0
  };

  for (let i = 0; i < limite; i++) {
    const proceso = await procesarSiguienteNotificacion();

    if (!proceso.procesada) break;

    resultado.procesadas++;

    if (proceso.estado === "enviada") {
      resultado.enviadas++;
    } else if (proceso.estado === "pendiente") {
      resultado.pendientes_reintento++;
    } else {
      resultado.errores++;
    }
  }

  return resultado;
}

module.exports = {
  procesarSiguienteNotificacion,
  procesarColaNotificaciones
};