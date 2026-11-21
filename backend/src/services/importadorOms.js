
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const BASE_OMS = path.join(__dirname, "../data/oms");

const CONFIGURACION = {
  peso: "peso_edad",
  talla: "talla_edad",
  "peso-talla": "peso_talla",
  "perimetro-cefalico": "perimetro_cefalico",
};

function obtenerSexo(nombre) {
  const archivo = nombre.toLowerCase();

  if (archivo.includes("boys")) return "masculino";
  if (archivo.includes("girls")) return "femenino";

  throw new Error(`No se pudo identificar el sexo del archivo: ${nombre}`);
}

function obtenerTipoMedicion(encabezados) {
  if (encabezados.includes("month")) return "meses";
  if (encabezados.includes("height")) return "cm";
  if (encabezados.includes("length")) return "cm";

  throw new Error(
    `No se encontró Month, Height ni Length. Encabezados: ${encabezados.join(", ")}`
  );
}

function convertirNumero(valor) {
  if (valor === undefined || valor === null || valor === "") return null;

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function buscarColumna(encabezados, nombre) {
  return encabezados.findIndex(
    (encabezado) => String(encabezado).trim().toLowerCase() === nombre.toLowerCase()
  );
}

async function importarArchivo(carpeta, archivo) {
  const ruta = path.join(BASE_OMS, carpeta, archivo);
  const workbook = XLSX.readFile(ruta);
  const hoja = workbook.Sheets[workbook.SheetNames[0]];

  const filas = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    defval: null,
  });

  if (!filas.length) {
    throw new Error(`El archivo está vacío: ${archivo}`);
  }

  const encabezados = filas[0].map((valor) =>
    String(valor ?? "").trim()
  );

  const sexo = obtenerSexo(archivo);
  const indicador = CONFIGURACION[carpeta];
  const tipoMedicion = obtenerTipoMedicion(
    encabezados.map((e) => e.toLowerCase())
  );

    const nombreColumnaMedicion =
    encabezados.find((e) => ["month", "height", "length"].includes(e.toLowerCase()));

    const indiceMedicion = buscarColumna(encabezados, nombreColumnaMedicion);
  const indiceL = buscarColumna(encabezados, "L");
  const indiceM = buscarColumna(encabezados, "M");
  const indiceS = buscarColumna(encabezados, "S");
  const indiceSD = buscarColumna(encabezados, "SD");

  const columnasZ = {
    SD3neg: buscarColumna(encabezados, "SD3neg"),
    SD2neg: buscarColumna(encabezados, "SD2neg"),
    SD1neg: buscarColumna(encabezados, "SD1neg"),
    SD0: buscarColumna(encabezados, "SD0"),
    SD1: buscarColumna(encabezados, "SD1"),
    SD2: buscarColumna(encabezados, "SD2"),
    SD3: buscarColumna(encabezados, "SD3"),
  };

  const indicesObligatorios = [
    indiceMedicion,
    indiceL,
    indiceM,
    indiceS,
    ...Object.values(columnasZ),
  ];

  if (indicesObligatorios.some((indice) => indice === -1)) {
    throw new Error(`Faltan columnas obligatorias en ${archivo}`);
  }

  const datos = filas.slice(1).filter((fila) => fila[indiceMedicion] !== null);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const referencia = await client.query(
      `INSERT INTO referencias_crecimiento
        (indicador, sexo, edad_tipo, archivo_origen, version_referencia, fuente, estado)
       VALUES ($1, $2, $3, $4, 'OMS 2006', 'OMS', TRUE)
       ON CONFLICT (indicador, sexo, archivo_origen)
       DO UPDATE SET
         edad_tipo = EXCLUDED.edad_tipo,
         version_referencia = EXCLUDED.version_referencia,
         estado = TRUE
       RETURNING id_referencia`,
      [indicador, sexo, tipoMedicion, archivo]
    );

    const idReferencia = referencia.rows[0].id_referencia;

    // Evita duplicar datos al ejecutar nuevamente el importador.
    await client.query(
      `DELETE FROM valores_referencia_oms
       WHERE id_referencia = $1`,
      [idReferencia]
    );

    for (const fila of datos) {
      const valorMedicion = convertirNumero(fila[indiceMedicion]);

      const valores = {
        L: convertirNumero(fila[indiceL]),
        M: convertirNumero(fila[indiceM]),
        S: convertirNumero(fila[indiceS]),
        SD: indiceSD !== -1 ? convertirNumero(fila[indiceSD]) : null,
        SD3neg: convertirNumero(fila[columnasZ.SD3neg]),
        SD2neg: convertirNumero(fila[columnasZ.SD2neg]),
        SD1neg: convertirNumero(fila[columnasZ.SD1neg]),
        SD0: convertirNumero(fila[columnasZ.SD0]),
        SD1: convertirNumero(fila[columnasZ.SD1]),
        SD2: convertirNumero(fila[columnasZ.SD2]),
        SD3: convertirNumero(fila[columnasZ.SD3]),
      };

      await client.query(
        `INSERT INTO valores_referencia_oms (
          id_referencia, edad_meses, medida_cm, tipo_medicion,
          L, M, S, SD, SD3neg, SD2neg, SD1neg, SD0, SD1, SD2, SD3
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )`,
        [
          idReferencia,
          tipoMedicion === "meses" ? valorMedicion : null,
          tipoMedicion === "cm" ? valorMedicion : null,
          tipoMedicion,
          valores.L,
          valores.M,
          valores.S,
          valores.SD,
          valores.SD3neg,
          valores.SD2neg,
          valores.SD1neg,
          valores.SD0,
          valores.SD1,
          valores.SD2,
          valores.SD3,
        ]
      );
    }

    await client.query("COMMIT");

    console.log(`✓ ${archivo}: ${datos.length} registros importados`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function importarOms() {
  let totalArchivos = 0;

  for (const carpeta of Object.keys(CONFIGURACION)) {
    const rutaCarpeta = path.join(BASE_OMS, carpeta);

    if (!fs.existsSync(rutaCarpeta)) {
      console.warn(`⚠ Carpeta no encontrada: ${carpeta}`);
      continue;
    }

    const archivos = fs
      .readdirSync(rutaCarpeta)
      .filter((archivo) => archivo.toLowerCase().endsWith(".xlsx"));

    for (const archivo of archivos) {
      await importarArchivo(carpeta, archivo);
      totalArchivos++;
    }
  }

  console.log(`\nImportación finalizada. Archivos procesados: ${totalArchivos}`);
}

module.exports = { importarOms };
