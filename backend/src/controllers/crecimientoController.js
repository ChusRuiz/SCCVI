const pool = require("../config/db");
const { evaluarCrecimientoOMS } = require("../services/evaluarCrecimientoOms");


function normalizarFecha(fecha) {
  if (!fecha) return null;

  const texto =
    fecha instanceof Date
      ? fecha.toISOString().slice(0, 10)
      : String(fecha).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;

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



const registrarControl = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const {
      id_paciente,
      fecha_control,
      peso_kg,
      talla_cm,
      perimetro_cefalico_cm,
      observaciones,
    } = req.body;

    // Validaciones iniciales
    if (!id_paciente || peso_kg == null || talla_cm == null) {
      return res.status(400).json({
        mensaje: "Paciente, peso y talla son obligatorios",
      });
    }

    const peso = Number(peso_kg);
    const talla = Number(talla_cm);

    const perimetro =
      perimetro_cefalico_cm == null || perimetro_cefalico_cm === ""
        ? null
        : Number(perimetro_cefalico_cm);

    if (
      !Number.isFinite(peso) ||
      !Number.isFinite(talla) ||
      peso <= 0 ||
      talla <= 0
    ) {
      return res.status(400).json({
        mensaje: "El peso y la talla deben ser mayores que cero",
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

    // Obtener fecha local actual en formato YYYY-MM-DD
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

    // Iniciar transacción
    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    // Consultar paciente
    const pacienteResult = await client.query(
      `SELECT id_paciente, fecha_nacimiento, sexo
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

    // Calcular edad exacta en meses cumplidos
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

    // Evaluar los indicadores con referencias OMS
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
      tallaCm: talla,
    });

    evaluaciones.peso_talla = await evaluarCrecimientoOMS({
      indicador: "peso_talla",
      sexo: paciente.sexo,
      edadMeses,
      pesoKg: peso,
      tallaCm: talla,
    });

    if (perimetro !== null) {
      evaluaciones.perimetro_cefalico =
        await evaluarCrecimientoOMS({
          indicador: "perimetro_cefalico",
          sexo: paciente.sexo,
          edadMeses,
          perimetroCefalicoCm: perimetro,
        });
    }

    // Insertar el control de crecimiento
    const controlResult = await client.query(
      `INSERT INTO controles_crecimiento
        (
          id_paciente,
          id_usuario,
          fecha_control,
          peso_kg,
          talla_cm,
          perimetro_cefalico_cm,
          observaciones
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id_paciente,
        req.usuario.id,
        fecha,
        peso,
        talla,
        perimetro,
        observaciones || null,
      ]
    );

    const control = controlResult.rows[0];

    // Guardar cada evaluación OMS asociada al control
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
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
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

    // Confirmar control y evaluaciones al mismo tiempo
    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.status(201).json({
      mensaje: "Control y evaluaciones OMS guardados correctamente",
      control,
      edad_meses: edadMeses,
      evaluaciones_oms: evaluaciones,
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
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



// HISTORIAL DE CRECIMIENTO DE UN PACIENTE

// HISTORIAL DE CRECIMIENTO DE UN PACIENTE
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
       ORDER BY c.fecha_control DESC, c.id_control DESC`,
      [id]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar historial de crecimiento:", error);

    res.status(500).json({
      mensaje: "Error al consultar historial de crecimiento",
    });
  }
};


// CONSULTAR UN CONTROL

// CONSULTAR UN CONTROL CON SUS EVALUACIONES OMS
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

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Error al consultar el control:", error);

    res.status(500).json({
      mensaje: "Error al consultar el control",
    });
  }
};


// ELIMINAR CONTROL
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

    res.json({
      mensaje: "Control eliminado correctamente",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al eliminar el control",
    });
  }
};

module.exports = {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  eliminarControl,
};