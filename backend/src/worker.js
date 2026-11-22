const { validarConfiguracionWorker } = require("./config/env");
validarConfiguracionWorker();

const pool = require("./config/db");
const { iniciarNotificacionesJob, detenerNotificacionesJob } = require("./jobs/notificacionesJob");
const { iniciarTelegramPolling, detenerTelegramPolling } = require("./services/telegramPollingService");

async function iniciarWorker() {
  await pool.query("SELECT 1");
  console.log("[SCCVI] Worker conectado a PostgreSQL.");
  iniciarNotificacionesJob();
  await iniciarTelegramPolling();
}

let cerrando = false;
async function detenerWorker(signal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`[SCCVI] Señal ${signal} recibida. Deteniendo worker...`);

  detenerNotificacionesJob();
  detenerTelegramPolling();

  try {
    await pool.end();
    console.log("[SCCVI] Worker detenido y conexiones cerradas.");
    process.exit(0);
  } catch (error) {
    console.error("[SCCVI] Error cerrando el worker:", error.message);
    process.exit(1);
  }

  setTimeout(() => process.exit(1), 30000).unref();
}

process.once("SIGTERM", () => detenerWorker("SIGTERM"));
process.once("SIGINT", () => detenerWorker("SIGINT"));

iniciarWorker().catch(async (error) => {
  console.error("[SCCVI] No se pudo iniciar el worker:", error.message);
  try { await pool.end(); } catch (_) { /* cierre de emergencia */ }
  process.exit(1);
});
