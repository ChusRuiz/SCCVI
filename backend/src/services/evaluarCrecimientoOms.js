const { buscarReferenciaOMS } = require("./referenciasOms");
const { calcularZOMS } = require("./calculadorOms");
const { interpretarIndicador } = require("./interpretadorOms");

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// Aproximación de la función de distribución normal estándar.
// El percentil se presenta como aproximado a partir de la puntuación Z.
function percentilDesdeZ(z) {
  const valor = numero(z);
  if (valor === null) return null;

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

async function evaluarCrecimientoOMS({
  indicador,
  sexo,
  edadMeses,
  pesoKg,
  tallaCm,
  perimetroCefalicoCm,
  tipoMedicion,
}) {
  let medicion;
  let medidaReferencia;
  let unidad;
  let tipoReferencia = tipoMedicion;

  switch (indicador) {
    case "peso_edad":
      medicion = numero(pesoKg);
      medidaReferencia = { edadMeses };
      unidad = "kg";
      break;

    case "talla_edad":
      medicion = numero(tallaCm);
      medidaReferencia = { edadMeses };
      unidad = "cm";
      break;

    case "peso_talla":
      medicion = numero(pesoKg);
      medidaReferencia = { medidaCm: tallaCm };
      unidad = "kg";
      tipoReferencia = tipoReferencia || (Number(edadMeses) < 24 ? "longitud" : "estatura");
      break;

    case "perimetro_cefalico":
      medicion = numero(perimetroCefalicoCm);
      medidaReferencia = { edadMeses };
      unidad = "cm";
      break;

    default:
      throw new Error("Indicador de crecimiento no válido");
  }

  if (medicion === null || medicion <= 0) {
    throw new Error("La medición del indicador debe ser un número mayor que cero");
  }

  const referencia = await buscarReferenciaOMS({
    indicador,
    sexo,
    edadMeses,
    ...medidaReferencia,
    tipoMedicion: tipoReferencia,
  });

  const puntuacionZ = calcularZOMS({
    x: medicion,
    l: referencia.l,
    m: referencia.m,
    s: referencia.s,
  });

  const interpretacion = interpretarIndicador(indicador, puntuacionZ);

  return {
    indicador,
    sexo,
    edadMeses: edadMeses ?? null,
    medicion,
    unidad,
    puntuacion_z: puntuacionZ,
    percentil_aproximado: percentilDesdeZ(puntuacionZ),
    estado: interpretacion.estado,
    descripcion: interpretacion.descripcion,
    interpretacion,
    referencia: {
      id_referencia: referencia.id_referencia,
      id_valor_referencia: referencia.id_valor_referencia,
      archivo: referencia.archivo_origen,
      version: referencia.version_referencia,
      l: referencia.l,
      m: referencia.m,
      s: referencia.s,
      edadReferencia: referencia.edad_meses,
      medidaReferencia: referencia.medida_cm,
      tipoMedicion: referencia.tipo_medicion_referencia,
      rango: referencia.rango_referencia,
    },
  };
}

module.exports = {
  evaluarCrecimientoOMS,
  percentilDesdeZ,
};