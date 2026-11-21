
const pool = require("../config/db");
const {
  evaluarCrecimientoOMS,
} = require("../services/evaluarCrecimientoOms");

// ============================================
// UTILIDADES DE FECHAS
// ============================================

function normalizarFecha(fecha) {
  if (!fecha) return null;

  const texto =
    fecha instanceof Date
      ? fecha.toISOString().slice(0, 10)
      : String(fecha).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return null;
  }

  const [anio, mes, dia] = texto.split("-").map(Number);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fechaUTC.getUTCFullYear() !== anio ||
    fechaUTC.getUTCMonth() !== mes - 1 ||
    fechaUTC.getUTCDate() !== dia
  ) {
    return null;
  }

  return texto;
}

// ============================================
// CALCULAR EDAD EN MESES CUMPLIDOS
// ============================================

function calcularEdadMeses(fechaNacimiento, fechaControl) {
  const nacimiento = normalizarFecha(fechaNacimiento);
  const control = normalizarFecha(fechaControl);

  if (!nacimiento || !control || control < nacimiento) {
    throw new Error(
      "Las fechas del paciente o del control no son válidas"
    );
  }

  const [anioN, mesN, diaN] = nacimiento.split("-").map(Number);
  const [anioC, mesC, diaC] = control.split("-").map(Number);

  let meses = (anioC - anioN) * 12 + (mesC - mesN);

  if (diaC < diaN) {
    meses--;
  }

  return meses;
}

// ============================================
// ESTANDARIZAR LONGITUD Y ESTATURA SEGÚN OMS
// ============================================

function estandarizarTallaOms(talla, edadMeses, metodo) {
  if (!["acostado", "de_pie"].includes(metodo)) {
    throw new Error("Método de medición de talla no válido");
  }

  let tallaEstandarizada = Number(talla);

  // Menores de 24 meses:
  // Se utiliza longitud acostado.
  // Si se midió de pie, se agregan 0.7 cm.

  if (edadMeses < 24 && metodo === "de_pie") {
    tallaEstandarizada += 0.7;
  }

  // Desde los 24 meses:
  // Se utiliza estatura de pie.
  // Si se midió acostado, se restan 0.7 cm.

  if (edadMeses >= 24 && metodo === "acostado") {
    tallaEstandarizada -= 0.7;
  }

  if (!Number.isFinite(tallaEstandarizada) || tallaEstandarizada <= 0) {
    throw new Error("La talla estandarizada no es válida");
  }

  return Number(tallaEstandarizada.toFixed(2));
}

// ============================================
// REGISTRAR CONTROL DE CRECIMIENTO
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

    // ----------------------------------------
    // 1. VALIDACIONES INICIALES
    // ----------------------------------------

    if (
      !id_paciente ||
      peso_kg == null ||
      talla_cm == null
    ) {
      return res.status(400).json({
        mensaje: "Paciente, peso y talla son obligatorios",
      });
    }

    const peso = Number(peso_kg);
    const talla = Number(talla_cm);

    const perimetro =
      perimetro_cefalico_cm == null ||
      perimetro_cefalico_cm === ""
        ? null
        : Number(perimetro_cefalico_cm);

    if (
      !Number.isFinite(peso) ||
      !Number.isFinite(talla) ||
      peso <= 0 ||
      talla <= 0
    ) {
      return res.status(400).json({
        mensaje: "El peso y la talla deben ser valores mayores que cero",
      });
    }

    if (
      perimetro !== null &&
      (!Number.isFinite(perimetro) || perimetro <= 0)
    ) {
      return res.status(400).json({
        mensaje: "El perímetro cefálico debe ser mayor que cero",
      });
    }

    if (!["acostado", "de_pie"].includes(metodo_medicion_talla)) {
      return res.status(400).json({
        mensaje: "Debes indicar si la talla fue medida acostado o de pie",
      });
    }

    // ----------------------------------------
    // 2. VALIDAR FECHA DEL CONTROL
    // ----------------------------------------

    const ahora = new Date();

    const hoy = [
      ahora.getFullYear(),
      String(ahora.getMonth() + 1).padStart(2, "0"),
      String(ahora.getDate()).padStart(2, "0"),
    ].join("-");

    const fecha = normalizarFecha(fecha_control || hoy);

    if (!fecha) {
      return res.status(400).json({
        mensaje: "La fecha del control no es válida",
      });
    }

    // ----------------------------------------
    // 3. INICIAR TRANSACCIÓN
    // ----------------------------------------

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    // ----------------------------------------
    // 4. CONSULTAR PACIENTE
    // ----------------------------------------

    const pacienteResult = await client.query(
      `SELECT
          id_paciente,
          fecha_nacimiento,
          sexo
       FROM pacientes
       WHERE id_paciente = $1
         AND estado = 'activo'`,
      [id_paciente]
    );

    if (pacienteResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Paciente no encontrado o inactivo",
      });
    }

    const paciente = pacienteResult.rows[0];

    if (!["masculino", "femenino"].includes(paciente.sexo)) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(422).json({
        mensaje: "El sexo del paciente no permite seleccionar una referencia OMS válida",
      });
    }

    // ----------------------------------------
    // 5. CALCULAR EDAD
    // ----------------------------------------

    const edadMeses = calcularEdadMeses(
      paciente.fecha_nacimiento,
      fecha
    );

    if (edadMeses < 0 || edadMeses > 60) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(422).json({
        mensaje: "Las referencias OMS configuradas cubren hasta los 60 meses",
        edad_meses: edadMeses,
      });
    }

    // ----------------------------------------
    // 6. ESTANDARIZAR TALLA
    // ----------------------------------------

    const tallaEstandarOms = estandarizarTallaOms(
      talla,
      edadMeses,
      metodo_medicion_talla
    );

    // ----------------------------------------
    // 7. EVALUACIONES OMS
    // ----------------------------------------

    const evaluaciones = {};

    // Peso para la edad

    evaluaciones.peso_edad = await evaluarCrecimientoOMS({
      indicador: "peso_edad",
      sexo: paciente.sexo,
      edadMeses,
      pesoKg: peso,
    });

    // Longitud/estatura para la edad

    evaluaciones.talla_edad = await evaluarCrecimientoOMS({
      indicador: "talla_edad",
      sexo: paciente.sexo,
      edadMeses,
      tallaCm: tallaEstandarOms,
    });

    // Peso para longitud/estatura

    evaluaciones.peso_talla = await evaluarCrecimientoOMS({
      indicador: "peso_talla",
      sexo: paciente.sexo,
      edadMeses,
      pesoKg: peso,
      tallaCm: tallaEstandarOms,
    });

    // Perímetro cefálico para la edad

    if (perimetro !== null) {
      evaluaciones.perimetro_cefalico =
        await evaluarCrecimientoOMS({
          indicador: "perimetro_cefalico",
          sexo: paciente.sexo,
          edadMeses,
          perimetroCefalicoCm: perimetro,
        });
    }

    // ----------------------------------------
    // 8. INSERTAR CONTROL
    // ----------------------------------------

    const controlResult = await client.query(
      `INSERT INTO controles_crecimiento (
          id_paciente,
          id_usuario,
          fecha_control,
          peso_kg,
          talla_cm,
          perimetro_cefalico_cm,
          observaciones,
          metodo_medicion_talla,
          talla_estandar_oms_cm
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        id_paciente,
        req.usuario.id,
        fecha,
        peso,
        talla,
        perimetro,
        observaciones || null,
        metodo_medicion_talla,
        tallaEstandarOms,
      ]
    );

    const control = controlResult.rows[0];

    // ----------------------------------------
    // 9. GUARDAR EVALUACIONES OMS
    // ----------------------------------------

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
         VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,$14
         )`,
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
          referencia.id_valor_referencia ?? null,
          referencia.l,
          referencia.m,
          referencia.s,
        ]
      );
    }

    // ----------------------------------------
    // 10. CONFIRMAR TRANSACCIÓN
    // ----------------------------------------

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.status(201).json({
      mensaje: "Control y evaluaciones OMS guardados correctamente",

      control,

      edad_meses: edadMeses,

      talla_original_cm: talla,
      metodo_medicion_talla,
      talla_estandar_oms_cm: tallaEstandarOms,

      evaluaciones_oms: evaluaciones,
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      try {
        await client.query("ROLLBACK");
      } catch (errorRollback) {
        console.error("Error al revertir transacción:", errorRollback);
      }
    }

    console.error("Error al registrar control:", error);

    return res.status(500).json({
      mensaje: "Error al registrar el control de crecimiento",
      detalle: error.message,
    });

  } finally {
    if (client) {
      client.release();
    }
  }
};

// ============================================
// HISTORIAL DE CRECIMIENTO DE UN PACIENTE
// ============================================

const obtenerHistorial = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `SELECT
          c.*,
          u.nombre AS usuario_registro,

          COALESCE(
            evaluaciones.evaluaciones_oms,
            '[]'::json
          ) AS evaluaciones_oms

       FROM controles_crecimiento c

       LEFT JOIN usuarios u
          ON c.id_usuario = u.id_usuario

       LEFT JOIN LATERAL (
          SELECT
            json_agg(
              json_build_object(
                'id_evaluacion', e.id_evaluacion,
                'indicador', e.indicador,
                'sexo', e.sexo,
                'edad_meses', e.edad_meses,
                'medicion', e.medicion,
                'unidad', e.unidad,
                'puntuacion_z', e.puntuacion_z,
                'estado', e.estado,
                'descripcion', e.descripcion,

                'referencia', json_build_object(
                  'id_referencia', r.id_referencia,
                  'archivo', r.archivo_origen,
                  'version', r.version_referencia,
                  'L', e.parametro_l,
                  'M', e.parametro_m,
                  'S', e.parametro_s
                )
              )
              ORDER BY e.indicador
            ) AS evaluaciones_oms

          FROM evaluaciones_crecimiento e

          LEFT JOIN referencias_crecimiento r
            ON e.id_referencia = r.id_referencia

          WHERE e.id_control = c.id_control

       ) evaluaciones ON TRUE

       WHERE c.id_paciente = $1

       ORDER BY
          c.fecha_control DESC,
          c.id_control DESC`,
      [id]
    );

    return res.json(resultado.rows);

  } catch (error) {
    console.error(
      "Error al consultar historial de crecimiento:",
      error
    );

    return res.status(500).json({
      mensaje: "Error al consultar historial de crecimiento",
    });
  }
};

// ============================================
// CONSULTAR UN CONTROL CON SUS EVALUACIONES OMS
// ============================================

const obtenerControl = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `SELECT
          c.*,
          p.nombres,
          p.apellidos,

          COALESCE(
            evaluaciones.evaluaciones_oms,
            '[]'::json
          ) AS evaluaciones_oms

       FROM controles_crecimiento c

       INNER JOIN pacientes p
          ON c.id_paciente = p.id_paciente

       LEFT JOIN LATERAL (
          SELECT
            json_agg(
              json_build_object(
                'id_evaluacion', e.id_evaluacion,
                'indicador', e.indicador,
                'sexo', e.sexo,
                'edad_meses', e.edad_meses,
                'medicion', e.medicion,
                'unidad', e.unidad,
                'puntuacion_z', e.puntuacion_z,
                'estado', e.estado,
                'descripcion', e.descripcion,

                'referencia', json_build_object(
                  'id_referencia', r.id_referencia,
                  'archivo', r.archivo_origen,
                  'version', r.version_referencia,
                  'L', e.parametro_l,
                  'M', e.parametro_m,
                  'S', e.parametro_s
                )
              )
              ORDER BY e.indicador
            ) AS evaluaciones_oms

          FROM evaluaciones_crecimiento e

          LEFT JOIN referencias_crecimiento r
            ON e.id_referencia = r.id_referencia

          WHERE e.id_control = c.id_control

       ) evaluaciones ON TRUE

       WHERE c.id_control = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Control no encontrado",
      });
    }

    return res.json(resultado.rows[0]);

  } catch (error) {
    console.error("Error al consultar el control:", error);

    return res.status(500).json({
      mensaje: "Error al consultar el control",
    });
  }
};

// ============================================
// ELIMINAR CONTROL
// ============================================

const eliminarControl = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `DELETE FROM controles_crecimiento
       WHERE id_control = $1
       RETURNING id_control`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Control no encontrado",
      });
    }

    return res.json({
      mensaje: "Control eliminado correctamente",
    });

  } catch (error) {
    console.error("Error al eliminar el control:", error);

    return res.status(500).json({
      mensaje: "Error al eliminar el control",
    });
  }
};


// ============================================
// OBTENER CURVAS OMS Y CONTROLES DEL PACIENTE
// ============================================


const obtenerCurvasOMS = async (req, res) => {
  try {
    const idPaciente = Number(req.params.id);

    if (!Number.isInteger(idPaciente) || idPaciente <= 0) {
      return res.status(400).json({
        mensaje: "Identificador de paciente no válido",
      });
    }

    // ========================================
    // 1. CONSULTAR PACIENTE
    // ========================================

    const pacienteResult = await pool.query(
      `SELECT id_paciente, fecha_nacimiento, sexo
       FROM pacientes
       WHERE id_paciente = $1`,
      [idPaciente]
    );

    if (pacienteResult.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    const paciente = pacienteResult.rows[0];

    // ========================================
    // 2. CONSULTAR CONTROLES
    // ========================================

    const controlesResult = await pool.query(
      `SELECT
          id_control,
          fecha_control,
          peso_kg,
          talla_cm,
          metodo_medicion_talla,
          talla_estandar_oms_cm,
          perimetro_cefalico_cm
       FROM controles_crecimiento
       WHERE id_paciente = $1
       ORDER BY fecha_control ASC, id_control ASC`,
      [idPaciente]
    );

    const controles = controlesResult.rows.map((control) => {
      const edadMeses = calcularEdadMeses(
        paciente.fecha_nacimiento,
        control.fecha_control
      );

      return {
        id_control: control.id_control,
        fecha_control: normalizarFecha(control.fecha_control),
        edad_meses: edadMeses,

        peso_kg: Number(control.peso_kg),
        talla_cm: Number(control.talla_cm),

        talla_estandar_oms_cm:
          control.talla_estandar_oms_cm == null
            ? null
            : Number(control.talla_estandar_oms_cm),

        metodo_medicion_talla: control.metodo_medicion_talla,

        perimetro_cefalico_cm:
          control.perimetro_cefalico_cm == null
            ? null
            : Number(control.perimetro_cefalico_cm),
      };
    });

    // ========================================
    // 3. PESO PARA LA EDAD
    // ========================================

    const pesoResult = await pool.query(
      `SELECT
          v.edad_meses,
          v.sd3neg,
          v.sd2neg,
          v.sd1neg,
          v.sd0,
          v.sd1,
          v.sd2,
          v.sd3,
          r.archivo_origen
       FROM referencias_crecimiento r
       INNER JOIN valores_referencia_oms v
          ON r.id_referencia = v.id_referencia
       WHERE r.indicador = 'peso_edad'
         AND r.sexo = $1
         AND r.estado = TRUE
       ORDER BY v.edad_meses`,
      [paciente.sexo]
    );

    // ========================================
    // 4. LONGITUD / ESTATURA PARA LA EDAD
    // ========================================

    const tallaResult = await pool.query(
      `SELECT
          v.edad_meses,
          v.sd3neg,
          v.sd2neg,
          v.sd1neg,
          v.sd0,
          v.sd1,
          v.sd2,
          v.sd3,
          r.archivo_origen
       FROM referencias_crecimiento r
       INNER JOIN valores_referencia_oms v
          ON r.id_referencia = v.id_referencia
       WHERE r.indicador = 'talla_edad'
         AND r.sexo = $1
         AND r.estado = TRUE
       ORDER BY v.edad_meses`,
      [paciente.sexo]
    );

    // Evitar mezclar archivos de diferentes rangos
    const referenciasTalla = tallaResult.rows.filter((fila) => {
      const edad = Number(fila.edad_meses);
      const archivo = fila.archivo_origen.toLowerCase();

      if (edad < 24) {
        return archivo.includes("0-to-2-years");
      }

      return archivo.includes("2-to-5-years");
    });

    // ========================================
    // 5. PESO PARA LONGITUD / ESTATURA
    // ========================================

    const pesoTallaResult = await pool.query(
      `SELECT
          v.medida_cm,
          v.sd3neg,
          v.sd2neg,
          v.sd1neg,
          v.sd0,
          v.sd1,
          v.sd2,
          v.sd3,
          r.archivo_origen
       FROM referencias_crecimiento r
       INNER JOIN valores_referencia_oms v
          ON r.id_referencia = v.id_referencia
       WHERE r.indicador = 'peso_talla'
         AND r.sexo = $1
         AND r.estado = TRUE
       ORDER BY v.medida_cm`,
      [paciente.sexo]
    );

    const curvasPesoLongitud = pesoTallaResult.rows.filter(
      (fila) =>
        fila.archivo_origen.toLowerCase().startsWith("wfl_")
    );

    const curvasPesoEstatura = pesoTallaResult.rows.filter(
      (fila) =>
        fila.archivo_origen.toLowerCase().startsWith("wfh_")
    );

    // ========================================
    // 6. PERÍMETRO CEFÁLICO PARA LA EDAD
    // ========================================

    const perimetroResult = await pool.query(
      `SELECT
          v.edad_meses,
          v.sd3neg,
          v.sd2neg,
          v.sd1neg,
          v.sd0,
          v.sd1,
          v.sd2,
          v.sd3,
          r.archivo_origen
       FROM referencias_crecimiento r
       INNER JOIN valores_referencia_oms v
          ON r.id_referencia = v.id_referencia
       WHERE r.indicador = 'perimetro_cefalico'
         AND r.sexo = $1
         AND r.estado = TRUE
       ORDER BY v.edad_meses`,
      [paciente.sexo]
    );

    // ========================================
    // 7. NORMALIZAR REFERENCIAS DE EDAD
    // ========================================

    const normalizarCurvaEdad = (fila) => ({
      edad_meses: Number(fila.edad_meses),

      z_menos_3: Number(fila.sd3neg),
      z_menos_2: Number(fila.sd2neg),
      z_menos_1: Number(fila.sd1neg),

      z_0: Number(fila.sd0),

      z_mas_1: Number(fila.sd1),
      z_mas_2: Number(fila.sd2),
      z_mas_3: Number(fila.sd3),

      archivo_origen: fila.archivo_origen,
    });

    // ========================================
    // 8. NORMALIZAR REFERENCIAS DE MEDIDA
    // ========================================

    const normalizarCurvaMedida = (fila) => ({
      medida_cm: Number(fila.medida_cm),

      z_menos_3: Number(fila.sd3neg),
      z_menos_2: Number(fila.sd2neg),
      z_menos_1: Number(fila.sd1neg),

      z_0: Number(fila.sd0),

      z_mas_1: Number(fila.sd1),
      z_mas_2: Number(fila.sd2),
      z_mas_3: Number(fila.sd3),

      archivo_origen: fila.archivo_origen,
    });

    const curvasPeso = pesoResult.rows.map(normalizarCurvaEdad);

    const curvasTalla = referenciasTalla.map(
      normalizarCurvaEdad
    );

    const curvasLongitud = curvasPesoLongitud.map(
      normalizarCurvaMedida
    );

    const curvasEstatura = curvasPesoEstatura.map(
      normalizarCurvaMedida
    );

    const curvasPerimetro = perimetroResult.rows.map(
      normalizarCurvaEdad
    );

    // ========================================
    // 9. RESPUESTA PARA EL FRONTEND
    // ========================================

    return res.json({
      paciente: {
        id_paciente: paciente.id_paciente,
        sexo: paciente.sexo,
      },

      curvas: {
        peso_edad: curvasPeso,
        talla_edad: curvasTalla,

        peso_longitud: curvasLongitud,
        peso_estatura: curvasEstatura,

        perimetro_cefalico: curvasPerimetro,
      },

      controles,

      controles_sin_talla_estandarizada: controles.filter(
        (control) => control.talla_estandar_oms_cm === null
      ).length,
    });

  } catch (error) {
    console.error("Error al obtener curvas OMS:", error);

    return res.status(500).json({
      mensaje: "Error al obtener las curvas de crecimiento OMS",
      detalle: error.message,
    });
  }
};



// ============================================
// EXPORTAR CONTROLADOR
// ============================================

module.exports = {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  eliminarControl,
  obtenerCurvasOMS,
};
