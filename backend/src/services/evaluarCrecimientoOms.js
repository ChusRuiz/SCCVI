
const { buscarReferenciaOMS } = require("./referenciasOms");
const { calcularZOMS } = require("./calculadorOms");
const { interpretarIndicador } = require("./interpretadorOms");

async function evaluarCrecimientoOMS({
  indicador,
  sexo,
  edadMeses,
  pesoKg,
  tallaCm,
  perimetroCefalicoCm,
}) {
  let medicion;
  let medidaReferencia;

  switch (indicador) {
    case "peso_edad":
      medicion = Number(pesoKg);
      medidaReferencia = {};
      break;

    case "talla_edad":
      medicion = Number(tallaCm);
      medidaReferencia = {};
      break;

    case "peso_talla":
      medicion = Number(pesoKg);
      medidaReferencia = { medidaCm: tallaCm };
      break;

    case "perimetro_cefalico":
      medicion = Number(perimetroCefalicoCm);
      medidaReferencia = {};
      break;

    default:
      throw new Error("Indicador de crecimiento no válido");
  }

  if (!Number.isFinite(medicion) || medicion <= 0) {
    throw new Error("La medida antropométrica no es válida");
  }

  // Buscar referencia OMS según indicador, sexo y edad.
  // En peso/talla también se utiliza la medida en centímetros.
  const referencia = await buscarReferenciaOMS({
    indicador,
    sexo,
    edadMeses,
    ...medidaReferencia,
  });

  // Calcular puntuación Z mediante parámetros LMS
  const puntuacionZ = calcularZOMS({
    x: medicion,
    l: referencia.l,
    m: referencia.m,
    s: referencia.s,
  });

  // Obtener interpretación del indicador
  const interpretacion = interpretarIndicador(
    indicador,
    puntuacionZ
  );

  return {
    indicador,
    sexo,
    edadMeses,
    medicion,
    unidad:
      indicador === "peso_edad" || indicador === "peso_talla"
        ? "kg"
        : "cm",
    puntuacion_z: puntuacionZ,

    interpretacion,

    referencia: {
  id_referencia: referencia.id_referencia,
  id_valor_referencia: referencia.id_valor,
  archivo: referencia.archivo_origen,
  version: referencia.version_referencia,
  l: referencia.l,
  m: referencia.m,
  s: referencia.s,
  edadReferencia: referencia.edad_meses,
  medidaReferencia: referencia.medida_cm,
  rango: referencia.rango_referencia,
},
  };
}

module.exports = { evaluarCrecimientoOMS };
