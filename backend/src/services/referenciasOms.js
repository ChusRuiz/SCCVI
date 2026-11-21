
const pool = require("../config/db");

const INDICADORES_VALIDOS = [
  "peso_edad",
  "talla_edad",
  "peso_talla",
  "perimetro_cefalico",
];

async function buscarReferenciaOMS({
  indicador,
  sexo,
  edadMeses,
  medidaCm,
}) {
  if (!INDICADORES_VALIDOS.includes(indicador)) {
    throw new Error("Indicador de crecimiento no válido");
  }

  if (!["masculino", "femenino"].includes(sexo)) {
    throw new Error("Sexo no válido");
  }

  if (edadMeses === undefined || edadMeses === null) {
    throw new Error("La edad en meses es obligatoria");
  }

  const edad = Number(edadMeses);

  if (!Number.isFinite(edad) || edad < 0 || edad > 60) {
    throw new Error("La edad debe estar entre 0 y 60 meses");
  }

  const esPesoTalla = indicador === "peso_talla";

  const valorBuscado = esPesoTalla
    ? Number(medidaCm)
    : edad;

  if (!Number.isFinite(valorBuscado) || valorBuscado <= 0 && esPesoTalla) {
    throw new Error("La medida de longitud o estatura no es válida");
  }

  // Consultar las referencias del indicador y sexo solicitados
  const sql = `
    SELECT
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
  `;

  const { rows } = await pool.query(sql, [indicador, sexo]);

  if (!rows.length) {
    throw new Error(
      `No existen referencias OMS para ${indicador} (${sexo})`
    );
  }

  let referenciasFiltradas = rows;

  // Seleccionar longitud para menores de 2 años
  // y estatura desde los 2 años
  if (indicador === "talla_edad") {
    const rangoArchivo =
      edad < 24 ? "0-to-2-years" : "2-to-5-years";

    referenciasFiltradas = rows.filter((fila) =>
      fila.archivo_origen.toLowerCase().includes(rangoArchivo)
    );
  }

  // Seleccionar peso para longitud o peso para estatura
  // según la edad del paciente
  if (indicador === "peso_talla") {
    const prefijo = edad < 24 ? "wfl_" : "wfh_";

    referenciasFiltradas = rows.filter((fila) =>
      fila.archivo_origen.toLowerCase().startsWith(prefijo)
    );
  }

  if (!referenciasFiltradas.length) {
    throw new Error(
      `No existe una referencia OMS apropiada para ${indicador}, ${sexo} y ${edad} meses`
    );
  }

  const columna = esPesoTalla ? "medida_cm" : "edad_meses";

  const filasValidas = referenciasFiltradas.filter((fila) => {
    const valor = Number(fila[columna]);
    return fila[columna] !== null && Number.isFinite(valor);
  });

  if (!filasValidas.length) {
    throw new Error("La referencia OMS no contiene valores válidos");
  }

  const valores = filasValidas.map((fila) => Number(fila[columna]));

  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);

  // No extrapolar fuera de los límites de las tablas OMS
  if (valorBuscado < minimo || valorBuscado > maximo) {
    throw new Error(
      `El valor ${valorBuscado} está fuera del rango de referencia OMS (${minimo} a ${maximo})`
    );
  }

  // Buscar la fila más cercana dentro del archivo correcto
  const filasOrdenadas = [...filasValidas].sort(
    (a, b) =>
      Math.abs(Number(a[columna]) - valorBuscado) -
      Math.abs(Number(b[columna]) - valorBuscado)
  );

  const filaSeleccionada = filasOrdenadas[0];

  return {
    ...filaSeleccionada,
    rango_referencia: {
      minimo,
      maximo,
    },
  };
}

module.exports = { buscarReferenciaOMS };
