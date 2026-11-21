
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const BASE_OMS = path.join(__dirname, "../data/oms");

const carpetas = [
  "peso",
  "talla",
  "peso-talla",
  "perimetro-cefalico",
];

function inspeccionarOms() {
  for (const carpeta of carpetas) {
    const rutaCarpeta = path.join(BASE_OMS, carpeta);

    console.log(`\n========== ${carpeta.toUpperCase()} ==========`);

    if (!fs.existsSync(rutaCarpeta)) {
      console.log("Carpeta no encontrada:", rutaCarpeta);
      continue;
    }

    const archivos = fs
      .readdirSync(rutaCarpeta)
      .filter((archivo) => /\.xlsx$/i.test(archivo));

    for (const archivo of archivos) {
      const rutaArchivo = path.join(rutaCarpeta, archivo);
      const workbook = XLSX.readFile(rutaArchivo);

      console.log("\n====================================");
      console.log("ARCHIVO:", archivo);

      for (const hojaNombre of workbook.SheetNames) {
        const hoja = workbook.Sheets[hojaNombre];

        const filas = XLSX.utils.sheet_to_json(hoja, {
          header: 1,
          defval: null,
          raw: true,
        });

        console.log("\nHOJA:", hojaNombre);
        console.log("RANGO:", hoja["!ref"]);
        console.log("TOTAL FILAS:", filas.length);

        console.log("\nPRIMERAS 12 FILAS:");
        console.table(filas.slice(0, 12));

        console.log("\nÚLTIMAS 5 FILAS:");
        console.table(filas.slice(-5));
      }
    }
  }
}

inspeccionarOms();
