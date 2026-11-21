const {
  interpretarIndicador,
  interpretarEvaluaciones,
} = require("../services/interpretadorOms");

console.log("\n===== PRUEBAS INTERPRETADOR OMS =====\n");

const casos = [
  { indicador: "peso_edad", z: -1.2662 },
  { indicador: "peso_edad", z: -2.5 },
  { indicador: "peso_edad", z: -3.5 },

  { indicador: "talla_edad", z: -1.5 },
  { indicador: "talla_edad", z: -2.6911 },
  { indicador: "talla_edad", z: -3.5 },

  { indicador: "peso_talla", z: -0.1817 },
  { indicador: "peso_talla", z: -2.5 },
  { indicador: "peso_talla", z: -3.5 },
  { indicador: "peso_talla", z: 2.5 },
  { indicador: "peso_talla", z: 3.5 },

  { indicador: "perimetro_cefalico", z: 0.4741 },
  { indicador: "perimetro_cefalico", z: -2.5 },
  { indicador: "perimetro_cefalico", z: 2.5 },
];

for (const caso of casos) {
  const resultado = interpretarIndicador(
    caso.indicador,
    caso.z
  );

  console.log(`Indicador: ${caso.indicador}`);
  console.log(`Z-score: ${caso.z}`);
  console.log(`Estado: ${resultado.estado}`);
  console.log(`Interpretacion: ${resultado.descripcion}`);
  console.log("--------------------------------------");
}

// Prueba de integración con evaluaciones OMS
const evaluacionesPrueba = {
  peso_edad: {
    puntuacion_z: -1.2662,
  },
  talla_edad: {
    puntuacion_z: -2.6911,
  },
  peso_talla: {
    puntuacion_z: -0.1817,
  },
  perimetro_cefalico: {
    puntuacion_z: 0.4741,
  },
};

console.log("\n===== INTEGRACION DE EVALUACIONES =====\n");

const resultadoIntegrado = interpretarEvaluaciones(
  evaluacionesPrueba
);

console.log(JSON.stringify(resultadoIntegrado, null, 2));

console.log("\n===== PRUEBAS COMPLETADAS =====");