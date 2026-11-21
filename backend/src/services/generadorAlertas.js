
const pool = require("../config/db");

// ============================================
// CONFIGURACION DE REGLAS
// ============================================

const CONFIG = {
  percentilMinimo: 5,
  percentilMaximo: 95,
  diasAvisoVacuna: 30,
  zCritico: 3,
};

// ============================================
// CONVERTIR PUNTUACION Z A PERCENTIL
// ============================================

// Aproximacion numerica de la funcion error.
function erf(x) {
  const signo = x < 0 ? -1 : 1;
  const valor = Math.abs(x);

  const t = 1 / (1 + 0.3275911 * valor);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const resultado =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t) *
      Math.exp(-valor * valor);

  return signo * resultado;
}

function puntuacionZAPercentil(puntuacionZ) {
  const z = Number(puntuacionZ);

  if (!Number.isFinite(z)) {
    throw new Error("La puntuacion Z no es numerica");
  }

  const percentil =
    50 * (1 + erf(z / Math.sqrt(2)));

  return Number(
    Math.min(100, Math.max(0, percentil)).toFixed(4)
  );
}

// ============================================
// GUARDAR O ACTUALIZAR ALERTA
// ============================================

async function guardarAlerta(client, datos) {
  const {
    id_paciente,
    tipo_alerta,
    prioridad,
    titulo,
    descripcion,
    origen,
    id_control = null,
    id_vacunacion = null,
    clave_unica,
    datos_adicionales = {},
  } = datos;

  const resultado = await client.query(
    `INSERT INTO alertas (
        id_paciente,
        tipo_alerta,
        prioridad,
        estado,
        titulo,
        descripcion,
        origen,
        id_control,
        id_vacunacion,
        clave_unica,
        datos
     )
     VALUES (
        $1, $2, $3, 'pendiente',
        $4, $5, $6, $7, $8, $9, $10::jsonb
     )

     ON CONFLICT (clave_unica)
     DO UPDATE SET
        prioridad = EXCLUDED.prioridad,
        titulo = EXCLUDED.titulo,
        descripcion = EXCLUDED.descripcion,
        datos = EXCLUDED.datos,
        actualizado_en = NOW()

     RETURNING id_alerta`,
    [
      id_paciente,
      tipo_alerta,
      prioridad,
      titulo,
      descripcion,
      origen,
      id_control,
      id_vacunacion,
      clave_unica,
      JSON.stringify(datos_adicionales),
    ]
  );

  return resultado.rows[0];
}

// ============================================
// OBTENER INFORMACION BASICA DEL PACIENTE
// ============================================

async function obtenerNombrePaciente(client, idPaciente) {
  const resultado = await client.query(
    `SELECT nombres, apellidos
     FROM pacientes
     WHERE id_paciente = $1`,
    [idPaciente]
  );

  if (!resultado.rows.length) {
    return "Paciente";
  }

  return `${resultado.rows[0].nombres} ${resultado.rows[0].apellidos}`;
}

// ============================================
// 1. ALERTAS POR EVALUACIONES OMS
// ============================================


async function generarAlertasCrecimiento(client) {
  const resultado = await client.query(
    `SELECT DISTINCT ON (c.id_paciente, ec.indicador)
        ec.id_control,
        c.id_paciente,
        c.fecha_control,
        ec.indicador,
        ec.medicion,
        ec.unidad,
        ec.puntuacion_z,
        ec.estado AS estado_oms,
        ec.descripcion,
        p.nombres,
        p.apellidos

     FROM evaluaciones_crecimiento ec

     INNER JOIN controles_crecimiento c
        ON c.id_control = ec.id_control

     INNER JOIN pacientes p
        ON p.id_paciente = c.id_paciente

     WHERE p.estado = 'activo'
       AND ec.puntuacion_z IS NOT NULL

     ORDER BY
        c.id_paciente,
        ec.indicador,
        c.fecha_control DESC,
        ec.id_control DESC`
  );

  let generadas = 0;

  for (const evaluacion of resultado.rows) {
    const z = Number(evaluacion.puntuacion_z);

    if (!Number.isFinite(z)) continue;

    const percentil = puntuacionZAPercentil(z);

    let tipoAlerta = null;
    let titulo = null;

    if (percentil < CONFIG.percentilMinimo) {
      tipoAlerta = "crecimiento_bajo";
      titulo = "Resultado de crecimiento por debajo del umbral";
    } else if (percentil > CONFIG.percentilMaximo) {
      tipoAlerta = "crecimiento_alto";
      titulo = "Resultado de crecimiento por encima del umbral";
    }

    if (!tipoAlerta) continue;

    const prioridad =
      Math.abs(z) >= CONFIG.zCritico
        ? "critica"
        : "preventiva";

    const nombrePaciente =
      `${evaluacion.nombres} ${evaluacion.apellidos}`;

    const indicador =
      evaluacion.indicador.replaceAll("_", " ");

    const descripcion =
      `${nombrePaciente} presenta un resultado de ${indicador} ` +
      `fuera del umbral configurado. ` +
      `Puntuacion Z: ${z.toFixed(4)}. ` +
      `Percentil aproximado: ${percentil}. ` +
      `Se recomienda revisar el control y la medicion.`;

    await guardarAlerta(client, {
      id_paciente: evaluacion.id_paciente,
      tipo_alerta: tipoAlerta,
      prioridad,
      titulo,
      descripcion,
      origen: "evaluacion_oms",
      id_control: evaluacion.id_control,

      clave_unica:
        `oms:${evaluacion.id_paciente}:` +
        `${evaluacion.id_control}:` +
        `${evaluacion.indicador}:${tipoAlerta}`,

      datos_adicionales: {
        indicador: evaluacion.indicador,
        medicion: evaluacion.medicion,
        unidad: evaluacion.unidad,
        puntuacion_z: z,
        percentil,
        estado_oms: evaluacion.estado_oms,
        fecha_control: evaluacion.fecha_control,
      },
    });

    generadas++;
  }

  return generadas;
}


// ============================================
// 2. ALERTAS POR CONTROLES ATRASADOS
// ============================================

async function generarAlertasControles(client) {
  const resultado = await client.query(
    `WITH pacientes_edad AS (
       SELECT
          p.id_paciente,
          p.nombres,
          p.apellidos,
          p.fecha_nacimiento,
          p.creado_en,

          (
            EXTRACT(
              YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)
            ) * 12
            +
            EXTRACT(
              MONTH FROM AGE(CURRENT_DATE, p.fecha_nacimiento)
            )
          )::INTEGER AS edad_meses

       FROM pacientes p

       WHERE p.estado = 'activo'
     )

     SELECT
        p.id_paciente,
        p.nombres,
        p.apellidos,
        p.edad_meses,
        ultimo.id_control,
        ultimo.fecha_control,
        COALESCE(
          ultimo.fecha_control::date,
          p.creado_en::date
        ) AS fecha_referencia,

        CASE
          WHEN p.edad_meses <= 24 THEN 1
          WHEN p.edad_meses <= 60 THEN 3
          ELSE NULL
        END AS meses_recomendados

     FROM pacientes_edad p

     LEFT JOIN LATERAL (
        SELECT
          c.id_control,
          c.fecha_control
        FROM controles_crecimiento c
        WHERE c.id_paciente = p.id_paciente
        ORDER BY c.fecha_control DESC, c.id_control DESC
        LIMIT 1
     ) ultimo ON TRUE

     WHERE
        p.edad_meses BETWEEN 0 AND 60

        AND COALESCE(
          ultimo.fecha_control::date,
          p.creado_en::date
        ) <= CURRENT_DATE - MAKE_INTERVAL(
          months => CASE
            WHEN p.edad_meses <= 24 THEN 1
            ELSE 3
          END
        )

     ORDER BY p.id_paciente`
  );

  let generadas = 0;

  for (const paciente of resultado.rows) {
    const nombrePaciente =
      `${paciente.nombres} ${paciente.apellidos}`;

    const mesesRecomendados =
      Number(paciente.meses_recomendados);

    const fechaUltimoControl =
      paciente.fecha_control || null;

    const descripcion =
      fechaUltimoControl
        ? `${nombrePaciente} no registra un nuevo control de crecimiento ` +
          `en el intervalo recomendado. El último control fue el ` +
          `${String(fechaUltimoControl).substring(0, 10)}.`
        : `${nombrePaciente} todavía no tiene controles de crecimiento registrados.`;

    const claveFecha =
      fechaUltimoControl
        ? String(fechaUltimoControl).substring(0, 10)
        : "sin-control";

    await guardarAlerta(client, {
      id_paciente: paciente.id_paciente,
      tipo_alerta: "control_atrasado",
      prioridad: "preventiva",
      titulo: "Control de crecimiento pendiente",
      descripcion,
      origen: "control_crecimiento",
      id_control: paciente.id_control,

      clave_unica:
        `control:${paciente.id_paciente}:${claveFecha}`,

      datos_adicionales: {
        edad_meses: paciente.edad_meses,
        meses_recomendados: mesesRecomendados,
        fecha_ultimo_control: fechaUltimoControl,
        fecha_referencia: paciente.fecha_referencia,
      },
    });

    generadas++;
  }

  return generadas;
}

// ============================================
// 3. ALERTAS POR VACUNAS PENDIENTES / ATRASADAS
// ============================================

async function generarAlertasVacunacion(client) {
  const resultado = await client.query(
    `SELECT
        v.id_vacunacion,
        v.id_paciente,
        v.id_vacuna,
        v.dosis,
        v.fecha_aplicacion,
        v.proxima_dosis::date AS proxima_dosis,
        (
          v.proxima_dosis::date - CURRENT_DATE
        )::INTEGER AS dias_restantes,

        va.nombre AS nombre_vacuna,

        p.nombres,
        p.apellidos

     FROM vacunaciones v

     INNER JOIN vacunas va
        ON va.id_vacuna = v.id_vacuna

     INNER JOIN pacientes p
        ON p.id_paciente = v.id_paciente

     WHERE
        p.estado = 'activo'
        AND v.proxima_dosis IS NOT NULL

        AND v.proxima_dosis::date <=
            CURRENT_DATE + ($1::INTEGER * INTERVAL '1 day')

     ORDER BY v.proxima_dosis ASC`,
    [CONFIG.diasAvisoVacuna]
  );

  let generadas = 0;

  for (const vacuna of resultado.rows) {
    const atrasada = Number(vacuna.dias_restantes) < 0;

    const tipoAlerta = atrasada
      ? "vacuna_atrasada"
      : "vacuna_pendiente";

    const prioridad = atrasada
      ? "critica"
      : "preventiva";

    const nombrePaciente =
      `${vacuna.nombres} ${vacuna.apellidos}`;

    const titulo = atrasada
      ? "Vacuna con fecha de aplicación vencida"
      : "Próxima dosis de vacunación";

    const descripcion = atrasada
      ? `${nombrePaciente} tiene pendiente la dosis ${vacuna.dosis} ` +
        `de ${vacuna.nombre_vacuna}. La fecha programada fue ` +
        `${vacuna.proxima_dosis}.`
      : `${nombrePaciente} tiene próxima la dosis ${vacuna.dosis} ` +
        `de ${vacuna.nombre_vacuna}. Fecha programada: ` +
        `${vacuna.proxima_dosis}.`;

    await guardarAlerta(client, {
      id_paciente: vacuna.id_paciente,
      tipo_alerta: tipoAlerta,
      prioridad,
      titulo,
      descripcion,
      origen: "vacunacion",
      id_vacunacion: vacuna.id_vacunacion,

      clave_unica:
        `vacuna:${vacuna.id_vacunacion}:` +
        `${vacuna.proxima_dosis}:${tipoAlerta}`,

      datos_adicionales: {
        id_vacuna: vacuna.id_vacuna,
        nombre_vacuna: vacuna.nombre_vacuna,
        dosis: vacuna.dosis,
        fecha_aplicacion: vacuna.fecha_aplicacion,
        proxima_dosis: vacuna.proxima_dosis,
        dias_restantes: vacuna.dias_restantes,
        atrasada,
      },
    });

    generadas++;
  }

  return generadas;
}

// ============================================
// GENERADOR PRINCIPAL
// ============================================

async function generarAlertas() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const crecimiento =
      await generarAlertasCrecimiento(client);

    const controles =
      await generarAlertasControles(client);

    const vacunacion =
      await generarAlertasVacunacion(client);

    await client.query("COMMIT");

    return {
      mensaje: "Generación de alertas completada",
      resultados: {
        crecimiento,
        controles,
        vacunacion,
        total: crecimiento + controles + vacunacion,
      },
    };

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error al generar alertas:", error);

    throw error;

  } finally {
    client.release();
  }
}

// ============================================
// EXPORTAR SERVICIO
// ============================================

module.exports = {
  generarAlertas,
  puntuacionZAPercentil,
};
