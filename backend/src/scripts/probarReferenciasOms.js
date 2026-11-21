const { buscarReferenciaOMS } = require("../services/referenciasOms");

async function ejecutarPruebas() {
  const pruebas = [
    {
      indicador: "peso_edad",
      sexo: "femenino",
      edadMeses: 12,
    },
    {
      indicador: "talla_edad",
      sexo: "femenino",
      edadMeses: 24,
    },
    {
      indicador: "peso_talla",
      sexo: "femenino",
      medidaCm: 60,
    },
    {
      indicador: "perimetro_cefalico",
      sexo: "femenino",
      edadMeses: 36,
    },
  ];

  console.log("\n===== PRUEBAS OMS - REFERENCIAS FEMENINAS =====\n");

  try {
    for (const prueba of pruebas) {
      const referencia = await buscarReferenciaOMS(prueba);

      console.log(`✓ ${prueba.indicador}`);
      console.log(`  Sexo: ${prueba.sexo}`);
      console.log(`  Archivo: ${referencia.archivo_origen}`);
      console.log(`  Edad: ${referencia.edad_meses ?? "N/A"}`);
      console.log(`  Medida: ${referencia.medida_cm ?? "N/A"}`);
      console.log(`  L: ${referencia.l}`);
      console.log(`  M: ${referencia.m}`);
      console.log(`  S: ${referencia.s}`);
      console.log("------------------------------------------\n");
    }

    console.log("===== TODAS LAS PRUEBAS COMPLETADAS =====");
  } catch (error) {
    console.error("\n✗ ERROR EN LAS PRUEBAS OMS:");
    console.error(error.message);
  } finally {
    process.exit();
  }
}

ejecutarPruebas();