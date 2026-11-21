const pool = require("../config/db");
const { evaluarCrecimientoOMS } = require("../services/evaluarCrecimientoOms");

const pruebas = [
  {
    nombre: "Peso para la edad",
    datos: {
      indicador: "peso_edad",
      sexo: "masculino",
      edadMeses: 12,
      pesoKg: 9.5,
    },
  },
  {
    nombre: "Talla para la edad",
    datos: {
      indicador: "talla_edad",
      sexo: "femenino",
      edadMeses: 24,
      tallaCm: 85,
    },
  },
  {
    nombre: "Peso para la longitud (menor de 2 años)",
    datos: {
      indicador: "peso_talla",
      sexo: "masculino",
      edadMeses: 18,
      pesoKg: 9.5,
      tallaCm: 75,
    },
  },
  {
    nombre: "Perímetro cefálico para la edad",
    datos: {
      indicador: "perimetro_cefalico",
      sexo: "femenino",
      edadMeses: 36,
      perimetroCefalicoCm: 48,
    },
  },
];

async function ejecutarPruebas() {
  console.log("\n===== EVALUACIÓN INTEGRADA OMS =====\n");

  try {
    for (const prueba of pruebas) {
      const resultado = await evaluarCrecimientoOMS(prueba.datos);

      console.log(`✓ ${prueba.nombre}`);
      console.log(`  Archivo OMS: ${resultado.referencia.archivo}`);
      console.log(`  Medición: ${resultado.medicion} ${resultado.unidad}`);
      console.log(`  Puntuación Z: ${resultado.puntuacion_z}`);
      console.log(`  Estado: ${resultado.interpretacion.estado}`);
      console.log(`  Interpretación: ${resultado.interpretacion.descripcion}`);
      console.log("----------------------------------------\n");
    }

    console.log("===== PRUEBAS COMPLETADAS =====");
  } catch (error) {
    console.error("\nError durante las pruebas:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

ejecutarPruebas();
