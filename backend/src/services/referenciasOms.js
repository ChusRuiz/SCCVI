const pool = require("../config/db");

const INDICADORES_VALIDOS = [
  "peso_edad",
  "talla_edad",
  "peso_talla",
  "perimetro_cefalico",
];

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function archivoPerteneceA(fila, prefijo) {
  return String(fila.archivo_origen || "")
    .toLowerCase()
    .startsWith(prefijo.toLowerCase());
}

/**
 * Busca el valor LMS de OMS que corresponde a un indicador y una medida.
 * Para peso/talla exige el tipo de referencia correcto:
 *   - longitud: WFL (0 a 2 años)
 *   - estatura: WFH (2 a 5 años)
 * Para talla/edad selecciona LHFA por edad, sin mezclar los dos archivos.
 */
async function buscarReferenciaOMS({
  indicador,
  sexo,
  edadMeses,
  medidaCm,
  tipoMedicion,
}) {
  if (!INDICADORES_VALIDOS.includes(indicador)) {
    throw new Error("Indicador de crecimiento no válido");
  }

  if (!["masculino", "femenino"].includes(sexo)) {
    throw new Error("Sexo no válido");
  }

  const esPesoTalla = indicador === "peso_talla";
  const valorBuscado = esPesoTalla ? numero(medidaCm) : numero(edadMeses);

  if (valorBuscado === null || valorBuscado < 0) {
    throw new Error("La edad o medida utilizada para buscar la referencia es inválida");
  }

  let tipo = tipoMedicion;
  if (esPesoTalla && !tipo && numero(edadMeses) !== null) {
    tipo = Number(edadMeses) < 24 ? "longitud" : "estatura";
  }

  if (esPesoTalla && !["longitud", "estatura"].includes(tipo)) {
    throw new Error("Para peso/talla debes indicar si la referencia es longitud o estatura");
  }

  const { rows } = await pool.query(
    `SELECT
        r.id_referencia,
        r.indicador,
        r.sexo,
        r.archivo_origen,
        r.version_referencia,
        v.id_valor,
        v.edad_meses,
        v.medida_cm,
        v.l,
        v.m,
        v.s,
        v.sd3neg,
        v.sd2neg,
        v.sd1neg,
        v.sd0,
        v.sd1,
        v.sd2,
        v.sd3,
        v.tipo_medicion
     FROM referencias_crecimiento r
     INNER JOIN valores_referencia_oms v
       ON v.id_referencia = r.id_referencia
     WHERE r.indicador = $1
       AND r.sexo = $2
       AND r.estado = TRUE
     ORDER BY r.archivo_origen,
              COALESCE(v.edad_meses, v.medida_cm)`,
    [indicador, sexo]
  );

  if (!rows.length) {
    throw new Error(`No existen referencias OMS para ${indicador} (${sexo})`);
  }

  let filasAplicables = rows;
  let columna = esPesoTalla ? "medida_cm" : "edad_meses";

  if (indicador === "talla_edad") {
    const edad = Number(edadMeses);
    const prefijo = edad < 24 ? "lhfa_" : "lhfa_";
    const fragmento = edad < 24 ? "0-to-2-years" : "2-to-5-years";
    filasAplicables = rows.filter((fila) => {
      const archivo = String(fila.archivo_origen || "").toLowerCase();
      return archivo.startsWith(prefijo) && archivo.includes(fragmento);
    });
  }

  if (indicador === "peso_talla") {
    const prefijo = tipo === "longitud" ? "wfl_" : "wfh_";
    filasAplicables = rows.filter((fila) => archivoPerteneceA(fila, prefijo));
  }

  if (!filasAplicables.length) {
    throw new Error(
      `No se encontró una tabla OMS ${tipo || "compatible"} para ${indicador} (${sexo})`
    );
  }

  // Agrupar por archivo de referencia; así no se mezclan tablas distintas.
  const gruposMap = new Map();

  for (const fila of filasAplicables) {
    const llave = fila.id_referencia;
    if (!gruposMap.has(llave)) {
      gruposMap.set(llave, {
        id_referencia: fila.id_referencia,
        archivo_origen: fila.archivo_origen,
        version_referencia: fila.version_referencia,
        filas: [],
      });
    }
    gruposMap.get(llave).filas.push(fila);
  }

  const grupos = [...gruposMap.values()].map((grupo) => {
    const valores = grupo.filas
      .map((fila) => numero(fila[columna]))
      .filter((valor) => valor !== null);

    return {
      ...grupo,
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
    };
  });

  // No extrapolar fuera del intervalo de la tabla OMS.
  const gruposQueContienen = grupos.filter(
    (grupo) => valorBuscado >= grupo.minimo && valorBuscado <= grupo.maximo
  );

  if (!gruposQueContienen.length) {
    const rangos = grupos
      .map((grupo) => `${grupo.archivo_origen}: ${grupo.minimo}–${grupo.maximo}`)
      .join("; ");

    throw new Error(
      `La medida ${valorBuscado} está fuera del rango de las referencias OMS disponibles. Rangos: ${rangos}`
    );
  }

  const grupoSeleccionado = gruposQueContienen.sort(
    (a, b) => (a.maximo - a.minimo) - (b.maximo - b.minimo)
  )[0];

  const filaSeleccionada = [...grupoSeleccionado.filas].sort(
    (a, b) =>
      Math.abs(Number(a[columna]) - valorBuscado) -
      Math.abs(Number(b[columna]) - valorBuscado)
  )[0];

  return {
    ...filaSeleccionada,
    id_valor_referencia: filaSeleccionada.id_valor,
    tipo_medicion_referencia: tipo || null,
    rango_referencia: {
      minimo: grupoSeleccionado.minimo,
      maximo: grupoSeleccionado.maximo,
    },
  };
}

module.exports = { buscarReferenciaOMS };