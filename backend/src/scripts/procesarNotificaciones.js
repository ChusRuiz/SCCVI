require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env")
});

const pool = require("../config/db");

const {
  procesarColaNotificaciones
} = require("../services/procesadorNotificaciones");

async function ejecutar() {
  try {
    console.log("Procesando notificaciones SCCVI...\n");

    const resultado = await procesarColaNotificaciones(20);

    console.table(resultado);

    console.log("\nProceso finalizado.");

  } catch (error) {
    console.error("Error:", error.message);

  } finally {
    await pool.end();
  }
}

ejecutar();