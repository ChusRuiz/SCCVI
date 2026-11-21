
const { calcularZOMS } = require("../services/calculadorOms");

const pruebas = [
  {
    nombre: "Caso LMS con L diferente de cero",
    x: 10,
    l: 0.2,
    m: 9.5,
    s: 0.1,
  },
  {
    nombre: "Caso LMS con L igual a cero",
    x: 10,
    l: 0,
    m: 9.5,
    s: 0.1,
  },
  {
    nombre: "Medición igual a la mediana",
    x: 9.5,
    l: 0.2,
    m: 9.5,
    s: 0.1,
  },
];

console.log("\n===== PRUEBAS CALCULADOR Z OMS =====\n");

for (const prueba of pruebas) {
  try {
    const resultado = calcularZOMS(prueba);

    console.log(`✓ ${prueba.nombre}`);
    console.log(`  Medición X: ${prueba.x}`);
    console.log(`  L: ${prueba.l}`);
    console.log(`  M: ${prueba.m}`);
    console.log(`  S: ${prueba.s}`);
    console.log(`  Resultado Z: ${resultado}`);
    console.log("----------------------------------");
  } catch (error) {
    console.error(`✗ ${prueba.nombre}: ${error.message}`);
  }
}

console.log("\n===== PRUEBAS FINALIZADAS =====");
