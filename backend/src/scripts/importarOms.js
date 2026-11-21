const { importarOms } = require("../services/importadorOms");

async function ejecutar() {
  try {
    await importarOms();
    process.exit(0);
  } catch (error) {
    console.error("\nError durante la importación OMS:");
    console.error(error.message);
    process.exit(1);
  }
}

ejecutar();