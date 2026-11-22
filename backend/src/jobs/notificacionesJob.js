const cron = require("node-cron");

const { generarAlertas } = require("../services/generadorAlertas");
const { generarNotificacionesDesdeAlertas } = require("../services/notificacionesService");
const { procesarColaNotificaciones } = require("../services/procesadorNotificaciones");

let ejecutandoCola = false;
let ejecutandoAlertas = false;
let tareaCola = null;
let tareaAlertas = null;

async function ejecutarCola() {
  if (ejecutandoCola) return;
  ejecutandoCola = true;

  try {
    const generadas = await generarNotificacionesDesdeAlertas();
    const procesadas = await procesarColaNotificaciones(20);
    console.log("[SCCVI] Cola revisada:", {
      nuevas: generadas.notificaciones_creadas,
      enviadas: procesadas.enviadas,
      errores: procesadas.errores,
    });
  } catch (error) {
    console.error("[SCCVI] Error procesando notificaciones:", error.message);
  } finally {
    ejecutandoCola = false;
  }
}

async function ejecutarGeneracionDiaria() {
  if (ejecutandoAlertas) return;
  ejecutandoAlertas = true;

  try {
    console.log("[SCCVI] Iniciando generación diaria de alertas...");
    const alertas = await generarAlertas();
    console.log("[SCCVI] Resultado de alertas:", alertas);

    const notificaciones = await generarNotificacionesDesdeAlertas();
    console.log("[SCCVI] Notificaciones generadas:", notificaciones);
    await ejecutarCola();
  } catch (error) {
    console.error("[SCCVI] Error en generación diaria:", error.message);
  } finally {
    ejecutandoAlertas = false;
  }
}

function iniciarNotificacionesJob() {
  if (tareaCola || tareaAlertas) {
    console.warn("[SCCVI] El programador de notificaciones ya está iniciado.");
    return;
  }

  tareaCola = cron.schedule("* * * * *", ejecutarCola, {
    name: "sccvi-cola-notificaciones",
    timezone: "America/Guatemala",
    noOverlap: true,
  });

  tareaAlertas = cron.schedule("0 7 * * *", ejecutarGeneracionDiaria, {
    name: "sccvi-generacion-alertas",
    timezone: "America/Guatemala",
    noOverlap: true,
  });

  console.log("----------------------------------");
  console.log("SCCVI - WORKER DE NOTIFICACIONES ACTIVO");
  console.log("Generación de alertas: 7:00 AM");
  console.log("Procesamiento de cola: cada minuto");
  console.log("Zona horaria: Guatemala");
  console.log("----------------------------------");

  ejecutarCola();
}

function detenerNotificacionesJob() {
  tareaCola?.stop();
  tareaAlertas?.stop();
  tareaCola = null;
  tareaAlertas = null;
  console.log("[SCCVI] Tareas programadas detenidas.");
}

module.exports = {
  iniciarNotificacionesJob,
  detenerNotificacionesJob,
  ejecutarCola,
  ejecutarGeneracionDiaria,
};
