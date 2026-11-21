function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convierte una puntuación Z a percentil aproximado usando la CDF normal estándar.
 * Es una equivalencia estadística aproximada; no sustituye la interpretación clínica OMS.
 */
export function percentilDesdeZ(z) {
  const valor = numero(z);
  if (valor === null) return null;

  // Aproximación de Abramowitz-Stegun para la cola normal.
  const absoluto = Math.abs(valor);
  const t = 1 / (1 + 0.2316419 * absoluto);
  const densidad = 0.3989422804014327 * Math.exp(-0.5 * absoluto * absoluto);
  const cola = densidad * t * (
    0.319381530 + t * (
      -0.356563782 + t * (
        1.781477937 + t * (
          -1.821255978 + t * 1.330274429
        )
      )
    )
  );

  const acumulada = valor >= 0 ? 1 - cola : cola;
  return Math.min(99.999, Math.max(0.001, acumulada * 100));
}

export function formatearPercentil(z) {
  const percentil = percentilDesdeZ(z);
  return percentil === null ? "—" : `P${percentil.toFixed(1)}`;
}
