
function calcularZ(valor, L, M, S) {
  valor = Number(valor);
  L = Number(L);
  M = Number(M);
  S = Number(S);

  if (![valor, L, M, S].every(Number.isFinite)) {
    throw new Error("Los parámetros del cálculo deben ser numéricos");
  }

  if (valor <= 0 || M <= 0 || S <= 0) {
    throw new Error("El valor, M y S deben ser mayores que cero");
  }

  let z;

  if (L === 0) {
    z = Math.log(valor / M) / S;
  } else {
    z = (Math.pow(valor / M, L) - 1) / (L * S);
  }

  if (!Number.isFinite(z)) {
    throw new Error("No fue posible calcular una puntuación Z válida");
  }

  return Number(z.toFixed(4));
}

module.exports = { calcularZ };
