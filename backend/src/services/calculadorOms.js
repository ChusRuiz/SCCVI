
function calcularZOMS({ x, l, m, s }) {
  x = Number(x);
  l = Number(l);
  m = Number(m);
  s = Number(s);

  if (![x, l, m, s].every(Number.isFinite)) {
    throw new Error("Los valores LMS y la medición deben ser numéricos");
  }

  if (x <= 0 || m <= 0 || s <= 0) {
    throw new Error("La medición, M y S deben ser mayores que cero");
  }

  let z;

  if (l === 0) {
    z = Math.log(x / m) / s;
  } else {
    z = (Math.pow(x / m, l) - 1) / (l * s);
  }

  if (!Number.isFinite(z)) {
    throw new Error("No fue posible calcular la puntuación Z");
  }

  return Number(z.toFixed(4));
}

module.exports = { calcularZOMS };
