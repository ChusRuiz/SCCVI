const cron = require("node-cron");

const {
  generarAlertas
} = require("../services/generadorAlertas");

const {
  generarNotificacionesDesdeAlertas
} = require("../services/notificacionesService");

const {
  procesarColaNotificaciones
} = require("../services/procesadorNotificaciones");

let ejecutandoCola = false;
let ejecutandoAlertas = false;

// Generar notificaciones y procesar la cola.
async function ejecutarCola() {
  if (ejecutandoCola) return;

  ejecutandoCola = true;

  try {
    const generadas =
      await generarNotificacionesDesdeAlertas();

    const procesadas =
      await procesarColaNotificaciones(20);

    console.log("[SCCVI] Cola revisada:", {
      nuevas: generadas.notificaciones_creadas,
      enviadas: procesadas.enviadas,
      errores: procesadas.errores
    });

  } catch (error) {
    console.error(
      "[SCCVI] Error procesando notificaciones:",
      error.message
    );

  } finally {
    ejecutandoCola = false;
  }
}

// Generar alertas diariamente.
async function ejecutarGeneracionDiaria() {
  if (ejecutandoAlertas) return;

  ejecutandoAlertas = true;

  try {
    console.log("[SCCVI] Iniciando generación diaria de alertas...");

    const alertas = await generarAlertas();

    console.log("[SCCVI] Resultado de alertas:", alertas);

    // Crear notificaciones a partir de las nuevas alertas.
    const notificaciones =
      await generarNotificacionesDesdeAlertas();

    console.log(
      "[SCCVI] Notificaciones generadas:",
      notificaciones
    );

    // Procesar inmediatamente la cola.
    await ejecutarCola();

  } catch (error) {
    console.error(
      "[SCCVI] Error en generación diaria:",
      error.message
    );

  } finally {
    ejecutandoAlertas = false;
  }
}

// Iniciar las tareas programadas.
function iniciarNotificacionesJob() {

  // Revisar la cola cada minuto.
  cron.schedule(
    "* * * * *",
    ejecutarCola,
    {
      name: "sccvi-cola-notificaciones",
      timezone: "America/Guatemala",
      noOverlap: true
    }
  );

  // Generar alertas diariamente a las 7:00 AM.
  cron.schedule(
    "0 7 * * *",
    ejecutarGeneracionDiaria,
    {
      name: "sccvi-generacion-alertas",
      timezone: "America/Guatemala",
      noOverlap: true
    }
  );

  console.log("----------------------------------");
  console.log("SCCVI - TAREAS AUTOMATICAS ACTIVAS");
  console.log("Generación de alertas: 7:00 AM");
  console.log("Procesamiento de cola: cada minuto");
  console.log("Zona horaria: Guatemala");
  console.log("----------------------------------");

  // Revisar la cola al iniciar el servidor.
  ejecutarCola();
}

module.exports = {
  iniciarNotificacionesJob
};