
const { calcularZ } = require("../services/calculadorZ");

const pruebas = [
  {
    nombre: "Medición igual a la mediana",
    valor: 3.3464,
    L: 0.3487,
    M: 3.3464,
    S: 0.14602,
    esperado: 0,
  },
  {
    nombre: "Prueba con L igual a cero",
    valor: 10,
    L: 0,
    M: 10,
    S: 0.1,
    esperado: 0,
  },
];

console.log("\n===== PRUEBAS DEL CALCULADOR Z =====\n");

for (const prueba of pruebas) {
  const resultado = calcularZ(
    prueba.valor,
    prueba.L,
    prueba.M,
    prueba.S
  );

  const correcto = resultado === prueba.esperado;

  console.log(`${correcto ? "✓" : "✗"} ${prueba.nombre}`);
  console.log(`  Resultado: ${resultado}`);
  console.log(`  Esperado: ${prueba.esperado}\n`);
}

console.log("===== FIN DE PRUEBAS =====");
