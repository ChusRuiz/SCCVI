const pool = require("../config/db");

function fechaISO(valor) {
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
  ) return null;
  return texto;
}

function edadEnMeses(fechaNacimiento, fechaControl) {
  const nacimiento = fechaISO(fechaNacimiento);
  const control = fechaISO(fechaControl);
  if (!nacimiento || !control || control < nacimiento) return null;

  const [anioN, mesN, diaN] = nacimiento.split("-").map(Number);
  const [anioC, mesC, diaC] = control.split("-").map(Number);
  let meses = (anioC - anioN) * 12 + (mesC - mesN);
  if (diaC < diaN) meses--;
  return meses;
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function mapearCurva(filas, eje) {
  return filas
    .map((fila) => ({
      [eje]: numero(eje === "edad_meses" ? fila.edad_meses : fila.medida_cm),
      z_menos_3: numero(fila.sd3neg),
      z_menos_2: numero(fila.sd2neg),
      z_menos_1: numero(fila.sd1neg),
      z_0: numero(fila.sd0),
      z_mas_1: numero(fila.sd1),
      z_mas_2: numero(fila.sd2),
      z_mas_3: numero(fila.sd3),
      archivo_origen: fila.archivo_origen,
    }))
    .filter((fila) =>
      fila[eje] !== null &&
      [
        fila.z_menos_3,
        fila.z_menos_2,
        fila.z_menos_1,
        fila.z_0,
        fila.z_mas_1,
        fila.z_mas_2,
        fila.z_mas_3,
      ].every((valor) => valor !== null)
    )
    .sort((a, b) => a[eje] - b[eje]);
}

async function cargarReferencias(client, indicador, sexo) {
  const { rows } = await client.query(
    `SELECT
        r.id_referencia,
        r.indicador,
        r.sexo,
        r.archivo_origen,
        r.version_referencia,
        v.edad_meses,
        v.medida_cm,
        v.sd3neg,
        v.sd2neg,
        v.sd1neg,
        v.sd0,
        v.sd1,
        v.sd2,
        v.sd3
     FROM referencias_crecimiento r
     INNER JOIN valores_referencia_oms v
       ON v.id_referencia = r.id_referencia
     WHERE r.indicador = $1
       AND r.sexo = $2
       AND r.estado = TRUE
     ORDER BY
       r.archivo_origen,
       COALESCE(v.edad_meses, v.medida_cm)`,
    [indicador, sexo]
  );
  return rows;
}

// GET /api/crecimiento/paciente/:id/curvas-oms
const obtenerCurvasOMS = async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    const idPaciente = Number(req.params.id);

    if (!Number.isInteger(idPaciente) || idPaciente <= 0) {
      return res.status(400).json({ mensaje: "Identificador de paciente no válido" });
    }

    const pacienteResult = await client.query(
      `SELECT id_paciente, nombres, apellidos, fecha_nacimiento, sexo
       FROM pacientes
       WHERE id_paciente = $1`,
      [idPaciente]
    );

    if (!pacienteResult.rows.length) {
      return res.status(404).json({ mensaje: "Paciente no encontrado" });
    }

    const paciente = pacienteResult.rows[0];

    const controlesResult = await client.query(
      `SELECT
          id_control,
          fecha_control,
          peso_kg,
          talla_cm,
          talla_estandar_oms_cm,
          metodo_medicion_talla,
          perimetro_cefalico_cm,
          COALESCE(evaluaciones.datos, '{}'::json) AS evaluaciones_oms
       FROM controles_crecimiento c
       LEFT JOIN LATERAL (
          SELECT json_object_agg(
            e.indicador,
            json_build_object(
              'indicador', e.indicador,
              'puntuacion_z', e.puntuacion_z,
              'estado', e.estado,
              'descripcion', e.descripcion,
              'medicion', e.medicion,
              'unidad', e.unidad
            )
          ) AS datos
          FROM evaluaciones_crecimiento e
          WHERE e.id_control = c.id_control
       ) evaluaciones ON TRUE
       WHERE c.id_paciente = $1
       ORDER BY c.fecha_control, c.id_control`,
      [idPaciente]
    );

    const controles = controlesResult.rows.map((control) => ({
      ...control,
      fecha_control: fechaISO(control.fecha_control),
      edad_meses: edadEnMeses(
        paciente.fecha_nacimiento,
        control.fecha_control
      ),
      peso_kg: numero(control.peso_kg),
      talla_cm: numero(control.talla_cm),
      talla_estandar_oms_cm: numero(control.talla_estandar_oms_cm),
      perimetro_cefalico_cm: numero(control.perimetro_cefalico_cm),
    }));

    const [pesoEdadRows, tallaEdadRows, pesoTallaRows, perimetroRows] =
      await Promise.all([
        cargarReferencias(client, "peso_edad", paciente.sexo),
        cargarReferencias(client, "talla_edad", paciente.sexo),
        cargarReferencias(client, "peso_talla", paciente.sexo),
        cargarReferencias(client, "perimetro_cefalico", paciente.sexo),
      ]);

    // Las referencias OMS de peso/talla comparten el indicador en la BD.
    // Se separan por el prefijo oficial de archivo: WFL (longitud) y WFH (estatura).
    const pesoLongitudRows = pesoTallaRows.filter((fila) =>
      String(fila.archivo_origen || "").toLowerCase().startsWith("wfl_")
    );
    const pesoEstaturaRows = pesoTallaRows.filter((fila) =>
      String(fila.archivo_origen || "").toLowerCase().startsWith("wfh_")
    );

    // Longitud/estatura para edad: usar el archivo de 0-2 años hasta los 23 meses
    // y el de 2-5 años desde los 24 meses para evitar duplicar ese punto.
    const tallaEdadUnificada = tallaEdadRows.filter((fila) => {
      const archivo = String(fila.archivo_origen || "").toLowerCase();
      const edad = numero(fila.edad_meses);
      if (edad === null) return false;
      if (archivo.includes("0-to-2-years")) return edad < 24;
      if (archivo.includes("2-to-5-years")) return edad >= 24;
      return true;
    });

    const curvas = {
      peso_edad: mapearCurva(pesoEdadRows, "edad_meses"),
      talla_edad: mapearCurva(tallaEdadUnificada, "edad_meses"),
      peso_longitud: mapearCurva(pesoLongitudRows, "medida_cm"),
      peso_estatura: mapearCurva(pesoEstaturaRows, "medida_cm"),
      perimetro_cefalico: mapearCurva(perimetroRows, "edad_meses"),
    };

    const sinTallaEstandarizada = controles.filter(
      (control) => control.talla_estandar_oms_cm === null
    ).length;

    return res.json({
      paciente: {
        id_paciente: paciente.id_paciente,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        sexo: paciente.sexo,
        fecha_nacimiento: fechaISO(paciente.fecha_nacimiento),
      },
      curvas,
      controles,
      controles_sin_talla_estandarizada: sinTallaEstandarizada,
    });
  } catch (error) {
    console.error("Error al construir curvas OMS:", error);
    return res.status(500).json({
      mensaje: "No se pudieron obtener las curvas de crecimiento OMS",
      detalle: error.message,
    });
  } finally {
    if (client) client.release();
  }
};

module.exports = { obtenerCurvasOMS };
