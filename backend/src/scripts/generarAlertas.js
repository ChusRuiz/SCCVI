
const pool = require("../config/db");
const { generarAlertas } = require("../services/generadorAlertas");

async function ejecutar() {
  try {
    console.log("\n===== GENERACION DE ALERTAS SCCVI =====\n");

    const resultado = await generarAlertas();

    console.log(resultado.mensaje);
    console.log("----------------------------------");
    console.log(
      "Alertas de crecimiento:",
      resultado.resultados.crecimiento
    );
    console.log(
      "Alertas de controles:",
      resultado.resultados.controles
    );
    console.log(
      "Alertas de vacunacion:",
      resultado.resultados.vacunacion
    );
    console.log("----------------------------------");
    console.log(
      "Total de alertas procesadas:",
      resultado.resultados.total
    );

    console.log("\n===== PROCESO COMPLETADO =====\n");

  } catch (error) {
    console.error("\nERROR AL GENERAR ALERTAS:");
    console.error(error.message);
    process.exitCode = 1;

  } finally {
    await pool.end();
  }
}

ejecutar();
