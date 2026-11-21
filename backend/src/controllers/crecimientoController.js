const pool = require("../config/db");
const { evaluarCrecimientoOMS, percentilDesdeZ } = require("../services/evaluarCrecimientoOms");

// ============================================
// FECHAS Y UTILIDADES
// ============================================

function normalizarFecha(valor) {
  if (!valor) return null;

  const texto = valor instanceof Date
    ? valor.toISOString().slice(0, 10)
    : String(valor).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;

  const [anio, mes, dia] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return texto;
}

function fechaLocalActual() {
  const ahora = new Date();
  return [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, "0"),
    String(ahora.getDate()).padStart(2, "0"),
  ].join("-");
}

function calcularEdadMeses(fechaNacimiento, fechaControl) {
  const nacimiento = normalizarFecha(fechaNacimiento);
  const control = normalizarFecha(fechaControl);

  if (!nacimiento || !control || control < nacimiento) {
    throw new Error("Las fechas del paciente o del control no son válidas");
  }

  const [anioN, mesN, diaN] = nacimiento.split("-").map(Number);
  const [anioC, mesC, diaC] = control.split("-").map(Number);

  let meses = (anioC - anioN) * 12 + (mesC - mesN);
  if (diaC < diaN) meses--;
  return meses;
}

function numeroPositivo(valor, nombre, obligatorio = true) {
  if (valor === null || valor === undefined || valor === "") {
    if (obligatorio) throw new Error(`${nombre} es obligatorio`);
    return null;
  }

  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${nombre} debe ser un número mayor que cero`);
  }
  return n;
}

/**
 * Convierte la medición ingresada a la medida estándar que requiere OMS:
 * - Menor de 24 meses: referencia de longitud acostado.
 *   Si se midió de pie, se suman 0.7 cm.
 * - Desde 24 meses: referencia de estatura de pie.
 *   Si se midió acostado, se restan 0.7 cm.
 */
function estandarizarTalla(tallaCm, edadMeses, metodo) {
  if (!["acostado", "de_pie"].includes(metodo)) {
    throw new Error("Debes indicar si la talla se midió acostado o de pie");
  }

  let estandarizada = tallaCm;

  if (edadMeses < 24 && metodo === "de_pie") {
    estandarizada = tallaCm + 0.7;
  } else if (edadMeses >= 24 && metodo === "acostado") {
    estandarizada = tallaCm - 0.7;
  }

  if (!Number.isFinite(estandarizada) || estandarizada <= 0) {
    throw new Error("La talla estandarizada OMS no es válida");
  }

  return Number(estandarizada.toFixed(2));
}

function agregarPercentiles(evaluaciones) {
  if (!evaluaciones || typeof evaluaciones !== "object") return {};

  return Object.fromEntries(
    Object.entries(evaluaciones).map(([indicador, evaluacion]) => [
      indicador,
      {
        ...evaluacion,
        percentil_aproximado: percentilDesdeZ(evaluacion.puntuacion_z),
      },
    ])
  );
}

function normalizarEvaluacionesJson(valor) {
  if (!valor) return {};
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor);
    } catch {
      return {};
    }
  }
  return valor;
}

// Consulta compartida para devolver el control con sus evaluaciones OMS.
const SQL_CONTROL_CON_EVALUACIONES = `
  SELECT
    c.*,
    u.nombre AS usuario_registro,
    COALESCE(ev.datos, '{}'::json) AS evaluaciones_oms
  FROM controles_crecimiento c
  LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
  LEFT JOIN LATERAL (
    SELECT json_object_agg(
      e.indicador,
      json_build_object(
        'indicador', e.indicador,
        'puntuacion_z', e.puntuacion_z,
        'estado', e.estado,
        'descripcion', e.descripcion,
        'medicion', e.medicion,
        'unidad', e.unidad,
        'edad_meses', e.edad_meses,
        'referencia', json_build_object(
          'archivo', r.archivo_origen,
          'version', r.version_referencia,
          'l', e.parametro_l,
          'm', e.parametro_m,
          's', e.parametro_s
        )
      )
    ) AS datos
    FROM evaluaciones_crecimiento e
    LEFT JOIN referencias_crecimiento r
      ON r.id_referencia = e.id_referencia
    WHERE e.id_control = c.id_control
  ) ev ON TRUE
`;

// ============================================
// REGISTRAR CONTROL Y EVALUACIONES OMS
// ============================================

const registrarControl = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const {
      id_paciente,
      fecha_control,
      peso_kg,
      talla_cm,
      metodo_medicion_talla,
      perimetro_cefalico_cm,
      observaciones,
    } = req.body;

    const idPaciente = Number(id_paciente);
    if (!Number.isInteger(idPaciente) || idPaciente <= 0) {
      return res.status(400).json({ mensaje: "Debes seleccionar un paciente válido" });
    }

    const peso = numeroPositivo(peso_kg, "El peso");
    const talla = numeroPositivo(talla_cm, "La talla");
    const perimetro = numeroPositivo(
      perimetro_cefalico_cm,
      "El perímetro cefálico",
      false
    );

    const fecha = normalizarFecha(fecha_control || fechaLocalActual());
    if (!fecha) {
      return res.status(400).json({ mensaje: "La fecha del control no es válida" });
    }

    if (fecha > fechaLocalActual()) {
      return res.status(400).json({ mensaje: "La fecha del control no puede ser futura" });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    transaccionIniciada = true;

    const pacienteResult = await client.query(
      `SELECT id_paciente, fecha_nacimiento, sexo
       FROM pacientes
       WHERE id_paciente = $1
         AND estado = 'activo'
       FOR UPDATE`,
      [idPaciente]
    );

    if (!pacienteResult.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: "Paciente no encontrado o inactivo" });
    }

    const paciente = pacienteResult.rows[0];
    const edadMeses = calcularEdadMeses(paciente.fecha_nacimiento, fecha);

    if (edadMeses < 0 || edadMeses > 60) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;
      return res.status(422).json({
        mensaje: "Las referencias OMS configuradas cubren desde el nacimiento hasta los 60 meses",
        edad_meses: edadMeses,
      });
    }

    const metodo = String(metodo_medicion_talla || "").trim();
    const tallaEstandar = estandarizarTalla(talla, edadMeses, metodo);
    const tipoReferenciaPesoTalla = edadMeses < 24 ? "longitud" : "estatura";

    // Todas las evaluaciones de talla utilizan la medida estandarizada OMS.
    const evaluaciones = {};

    evaluaciones.peso_edad = await evaluarCrecimientoOMS({
      indicador: "peso_edad",
      sexo: paciente.sexo,
      edadMeses,
      pesoKg: peso,
    });

    evaluaciones.talla_edad = await evaluarCrecimientoOMS({
      indicador: "talla_edad",
      sexo: paciente.sexo,
      edadMeses,
      tallaCm: tallaEstandar,
    });

    evaluaciones.peso_talla = await evaluarCrecimientoOMS({
      indicador: "peso_talla",
      sexo: paciente.sexo,
      edadMeses,
      pesoKg: peso,
      tallaCm: tallaEstandar,
      tipoMedicion: tipoReferenciaPesoTalla,
    });

    if (perimetro !== null) {
      evaluaciones.perimetro_cefalico = await evaluarCrecimientoOMS({
        indicador: "perimetro_cefalico",
        sexo: paciente.sexo,
        edadMeses,
        perimetroCefalicoCm: perimetro,
      });
    }

    const controlResult = await client.query(
      `INSERT INTO controles_crecimiento (
          id_paciente,
          id_usuario,
          fecha_control,
          peso_kg,
          talla_cm,
          talla_estandar_oms_cm,
          metodo_medicion_talla,
          perimetro_cefalico_cm,
          observaciones
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        idPaciente,
        req.usuario.id,
        fecha,
        peso,
        talla,
        tallaEstandar,
        metodo,
        perimetro,
        observaciones || null,
      ]
    );

    const control = controlResult.rows[0];

    for (const [indicador, evaluacion] of Object.entries(evaluaciones)) {
      const referencia = evaluacion.referencia;
      const interpretacion = evaluacion.interpretacion;

      await client.query(
        `INSERT INTO evaluaciones_crecimiento (
            id_control,
            indicador,
            sexo,
            edad_meses,
            medicion,
            unidad,
            puntuacion_z,
            estado,
            descripcion,
            id_referencia,
            id_valor_referencia,
            parametro_l,
            parametro_m,
            parametro_s
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          control.id_control,
          indicador,
          paciente.sexo,
          edadMeses,
          evaluacion.medicion,
          evaluacion.unidad,
          evaluacion.puntuacion_z,
          interpretacion.estado,
          interpretacion.descripcion,
          referencia.id_referencia,
          referencia.id_valor_referencia,
          referencia.l,
          referencia.m,
          referencia.s,
        ]
      );
    }

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.status(201).json({
      mensaje: "Control y evaluaciones OMS guardados correctamente",
      control,
      edad_meses: edadMeses,
      tipo_referencia_peso_talla: tipoReferenciaPesoTalla,
      evaluaciones_oms: agregarPercentiles(evaluaciones),
    });
  } catch (error) {
    if (client && transaccionIniciada) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error al revertir control:", rollbackError);
      }
    }

    console.error("Error al registrar control:", error);

    const mensajeValidacion = [
      "El peso",
      "La talla",
      "El perímetro cefálico",
      "Debes indicar",
      "La edad",
      "La medida",
      "La medición",
      "Las fechas",
      "La medida ",
      "No existen referencias",
      "No se encontró una tabla",
      "está fuera del rango",
    ].some((fragmento) => error.message.includes(fragmento));

    return res.status(mensajeValidacion ? 400 : 500).json({
      mensaje: mensajeValidacion
        ? error.message
        : "Error al registrar o evaluar el control de crecimiento",
      detalle: error.message,
    });
  } finally {
    if (client) client.release();
  }
};

// ============================================
// HISTORIAL DE CRECIMIENTO CON EVALUACIONES OMS
// ============================================

const obtenerHistorial = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: "Identificador de paciente no válido" });
    }

    const resultado = await pool.query(
      `${SQL_CONTROL_CON_EVALUACIONES}
       WHERE c.id_paciente = $1
       ORDER BY c.fecha_control DESC, c.id_control DESC`,
      [id]
    );

    const controles = resultado.rows.map((control) => {
      const evaluaciones = normalizarEvaluacionesJson(control.evaluaciones_oms);
      return {
        ...control,
        evaluaciones_oms: agregarPercentiles(evaluaciones),
      };
    });

    return res.json(controles);
  } catch (error) {
    console.error("Error al consultar historial de crecimiento:", error);
    return res.status(500).json({ mensaje: "Error al consultar historial de crecimiento" });
  }
};

// ============================================
// CONSULTAR UN CONTROL CON EVALUACIONES OMS
// ============================================

const obtenerControl = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: "Identificador de control no válido" });
    }

    const resultado = await pool.query(
      `SELECT
          c.*,
          p.nombres,
          p.apellidos,
          COALESCE(ev.datos, '{}'::json) AS evaluaciones_oms
       FROM controles_crecimiento c
       INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
       LEFT JOIN LATERAL (
          SELECT json_object_agg(
            e.indicador,
            json_build_object(
              'indicador', e.indicador,
              'puntuacion_z', e.puntuacion_z,
              'estado', e.estado,
              'descripcion', e.descripcion,
              'medicion', e.medicion,
              'unidad', e.unidad,
              'edad_meses', e.edad_meses,
              'referencia', json_build_object(
                'archivo', r.archivo_origen,
                'version', r.version_referencia,
                'l', e.parametro_l,
                'm', e.parametro_m,
                's', e.parametro_s
              )
            )
          ) AS datos
          FROM evaluaciones_crecimiento e
          LEFT JOIN referencias_crecimiento r
            ON r.id_referencia = e.id_referencia
          WHERE e.id_control = c.id_control
       ) ev ON TRUE
       WHERE c.id_control = $1`,
      [id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({ mensaje: "Control no encontrado" });
    }

    const control = resultado.rows[0];
    control.evaluaciones_oms = agregarPercentiles(
      normalizarEvaluacionesJson(control.evaluaciones_oms)
    );

    return res.json(control);
  } catch (error) {
    console.error("Error al consultar el control:", error);
    return res.status(500).json({ mensaje: "Error al consultar el control" });
  }
};

// ============================================
// ELIMINAR CONTROL
// ============================================

const eliminarControl = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: "Identificador de control no válido" });
    }

    const resultado = await pool.query(
      `DELETE FROM controles_crecimiento
       WHERE id_control = $1
       RETURNING id_control`,
      [id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({ mensaje: "Control no encontrado" });
    }

    return res.json({ mensaje: "Control eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar el control:", error);
    return res.status(500).json({ mensaje: "Error al eliminar el control" });
  }
};

module.exports = {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  eliminarControl,
};
