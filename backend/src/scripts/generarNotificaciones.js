require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env")
});

const pool = require("../config/db");

const {
  generarNotificacionesDesdeAlertas
} = require("../services/notificacionesService");

async function ejecutar() {
  try {
    console.log("Generando notificaciones...\n");

    const resultado =
      await generarNotificacionesDesdeAlertas();

    console.table(resultado);

    console.log("\nProceso completado.");

  } catch (error) {
    console.error("Error:", error.message);

  } finally {
    await pool.end();
  }
}

ejecutar();