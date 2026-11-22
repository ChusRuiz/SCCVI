const pool = require("../config/db");

function validarRangoFechas(req, res) {
  const { fecha_inicio = null, fecha_fin = null } = req.query;
  const formato = /^\d{4}-\d{2}-\d{2}$/;

  for (const [campo, valor] of Object.entries({ fecha_inicio, fecha_fin })) {
    if (valor !== null && (typeof valor !== "string" || !formato.test(valor))) {
      res.status(400).json({
        success: false,
        mensaje: `${campo} debe tener formato YYYY-MM-DD.`,
      });
      return null;
    }
  }

  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) {
    res.status(400).json({
      success: false,
      mensaje: "La fecha inicial no puede ser posterior a la fecha final.",
    });
    return null;
  }

  return [fecha_inicio, fecha_fin];
}

const SQL_BAJO_PESO = `
  WITH ultimo_control AS (
    SELECT DISTINCT ON (c.id_paciente)
      c.id_control,
      c.id_paciente,
      c.fecha_control,
      c.peso_kg,
      c.talla_cm,
      c.perimetro_cefalico_cm
    FROM controles_crecimiento c
    WHERE ($1::DATE IS NULL OR c.fecha_control::DATE >= $1::DATE)
      AND ($2::DATE IS NULL OR c.fecha_control::DATE <= $2::DATE)
    ORDER BY c.id_paciente, c.fecha_control DESC, c.id_control DESC
  )
  SELECT
    p.id_paciente,
    p.nombres,
    p.apellidos,
    p.fecha_nacimiento,
    p.sexo,
    c.nombre AS comunidad,
    uc.id_control,
    uc.fecha_control,
    uc.peso_kg,
    uc.talla_cm,
    e.puntuacion_z,
    e.estado AS estado_oms,
    e.descripcion
  FROM ultimo_control uc
  INNER JOIN pacientes p ON p.id_paciente = uc.id_paciente
  LEFT JOIN comunidades c ON c.id_comunidad = p.id_comunidad
  INNER JOIN evaluaciones_crecimiento e
    ON e.id_control = uc.id_control
   AND e.indicador = 'peso_edad'
   AND e.estado IN ('peso_bajo', 'peso_muy_bajo')
  WHERE p.estado = 'activo'
  ORDER BY uc.fecha_control DESC, p.apellidos, p.nombres
`;

const SQL_SOBREPESO = `
  WITH ultimo_control AS (
    SELECT DISTINCT ON (c.id_paciente)
      c.id_control,
      c.id_paciente,
      c.fecha_control,
      c.peso_kg,
      c.talla_cm,
      c.talla_estandar_oms_cm
    FROM controles_crecimiento c
    WHERE ($1::DATE IS NULL OR c.fecha_control::DATE >= $1::DATE)
      AND ($2::DATE IS NULL OR c.fecha_control::DATE <= $2::DATE)
    ORDER BY c.id_paciente, c.fecha_control DESC, c.id_control DESC
  )
  SELECT
    p.id_paciente,
    p.nombres,
    p.apellidos,
    p.fecha_nacimiento,
    p.sexo,
    c.nombre AS comunidad,
    uc.id_control,
    uc.fecha_control,
    uc.peso_kg,
    COALESCE(uc.talla_estandar_oms_cm, uc.talla_cm) AS talla_referencia_cm,
    e.puntuacion_z,
    e.estado AS estado_oms,
    e.descripcion
  FROM ultimo_control uc
  INNER JOIN pacientes p ON p.id_paciente = uc.id_paciente
  LEFT JOIN comunidades c ON c.id_comunidad = p.id_comunidad
  INNER JOIN evaluaciones_crecimiento e
    ON e.id_control = uc.id_control
   AND e.indicador = 'peso_talla'
   AND e.estado IN ('sobrepeso', 'obesidad')
  WHERE p.estado = 'activo'
  ORDER BY uc.fecha_control DESC, p.apellidos, p.nombres
`;

const SQL_VACUNAS_INCOMPLETAS = `
  WITH por_vacuna AS (
    SELECT
      v.id_paciente,
      va.id_vacuna,
      va.nombre AS vacuna,
      va.estado AS vacuna_activa,
      GREATEST(COALESCE(va.numero_dosis, 1), 1)::INTEGER AS dosis_requeridas,
      COUNT(DISTINCT v.dosis)::INTEGER AS dosis_aplicadas,
      BOOL_OR(v.proxima_dosis IS NOT NULL) AS tiene_proxima_dosis,
      MAX(v.proxima_dosis) AS proxima_dosis
    FROM vacunaciones v
    INNER JOIN vacunas va ON va.id_vacuna = v.id_vacuna
    WHERE ($1::DATE IS NULL OR v.fecha_aplicacion::DATE <= $1::DATE)
    GROUP BY
      v.id_paciente,
      va.id_vacuna,
      va.nombre,
      va.estado,
      va.numero_dosis
  ),
  catalogo_activo AS (
    SELECT COUNT(*)::INTEGER AS total_vacunas_activas
    FROM vacunas
    WHERE estado = TRUE
  ),
  resumen_paciente AS (
    SELECT
      pv.id_paciente,
      COUNT(*)::INTEGER AS vacunas_con_registro,
      COUNT(*) FILTER (
        WHERE pv.vacuna_activa = TRUE
      )::INTEGER AS vacunas_activas_con_registro,
      COUNT(*) FILTER (
        WHERE pv.vacuna_activa = TRUE
          AND (
            pv.dosis_aplicadas < pv.dosis_requeridas
            OR pv.tiene_proxima_dosis
          )
      )::INTEGER AS vacunas_pendientes,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id_vacuna', pv.id_vacuna,
            'vacuna', pv.vacuna,
            'dosis_aplicadas', pv.dosis_aplicadas,
            'dosis_requeridas', pv.dosis_requeridas,
            'proxima_dosis', pv.proxima_dosis
          ) ORDER BY pv.vacuna
        ) FILTER (
          WHERE pv.vacuna_activa = TRUE
            AND (
              pv.dosis_aplicadas < pv.dosis_requeridas
              OR pv.tiene_proxima_dosis
            )
        ),
        '[]'::JSON
      ) AS detalle_pendientes
    FROM por_vacuna pv
    GROUP BY pv.id_paciente
  )
  SELECT
    p.id_paciente,
    p.nombres,
    p.apellidos,
    p.fecha_nacimiento,
    c.nombre AS comunidad,
    COALESCE(rp.vacunas_pendientes, 0)::INTEGER AS vacunas_pendientes,
    COALESCE(rp.vacunas_con_registro, 0)::INTEGER AS vacunas_con_registro,
    COALESCE(rp.vacunas_activas_con_registro, 0)::INTEGER AS vacunas_activas_con_registro,
    COALESCE(rp.detalle_pendientes, '[]'::JSON) AS detalle_pendientes,
    CASE
      WHEN COALESCE(rp.vacunas_con_registro, 0) = 0 THEN 'sin_registros'
      WHEN ca.total_vacunas_activas > 0
       AND COALESCE(rp.vacunas_activas_con_registro, 0) = 0
        THEN 'sin_registros_vacunas_activas'
      ELSE 'incompleto'
    END AS motivo
  FROM pacientes p
  CROSS JOIN catalogo_activo ca
  LEFT JOIN comunidades c ON c.id_comunidad = p.id_comunidad
  LEFT JOIN resumen_paciente rp ON rp.id_paciente = p.id_paciente
  WHERE p.estado = 'activo'
    AND (
      COALESCE(rp.vacunas_con_registro, 0) = 0
      OR (
        ca.total_vacunas_activas > 0
        AND COALESCE(rp.vacunas_activas_con_registro, 0) = 0
      )
      OR COALESCE(rp.vacunas_pendientes, 0) > 0
    )
  ORDER BY p.apellidos, p.nombres
`;

const SQL_COBERTURA_COMUNIDAD = `
  WITH comunidades_reporte AS (
    SELECT id_comunidad, nombre
    FROM comunidades
    WHERE estado = 'activa'

    UNION ALL

    SELECT NULL::INTEGER AS id_comunidad,
           'Sin comunidad asignada'::VARCHAR(120) AS nombre
    WHERE EXISTS (
      SELECT 1
      FROM pacientes
      WHERE estado = 'activo'
        AND id_comunidad IS NULL
    )
  )
  SELECT
    co.id_comunidad,
    co.nombre AS comunidad,
    COUNT(DISTINCT p.id_paciente)::INTEGER AS pacientes_activos,
    COUNT(DISTINCT p.id_paciente) FILTER (
      WHERE v.id_vacunacion IS NOT NULL
    )::INTEGER AS pacientes_con_vacuna_en_periodo,
    COUNT(DISTINCT v.id_vacunacion)::INTEGER AS dosis_aplicadas_en_periodo,
    CASE
      WHEN COUNT(DISTINCT p.id_paciente) = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(DISTINCT p.id_paciente) FILTER (
          WHERE v.id_vacunacion IS NOT NULL
        ) / COUNT(DISTINCT p.id_paciente), 2
      )
    END AS cobertura_registral_porcentaje
  FROM comunidades_reporte co
  LEFT JOIN pacientes p
    ON p.id_comunidad IS NOT DISTINCT FROM co.id_comunidad
   AND p.estado = 'activo'
  LEFT JOIN vacunaciones v
    ON v.id_paciente = p.id_paciente
   AND ($1::DATE IS NULL OR v.fecha_aplicacion::DATE >= $1::DATE)
   AND ($2::DATE IS NULL OR v.fecha_aplicacion::DATE <= $2::DATE)
  GROUP BY co.id_comunidad, co.nombre
  ORDER BY co.nombre
`;

const SQL_CRECIMIENTO_PROMEDIO = `
  WITH ultimo_control AS (
    SELECT DISTINCT ON (c.id_paciente)
      c.id_control,
      c.id_paciente,
      c.fecha_control,
      c.peso_kg,
      c.talla_cm,
      c.perimetro_cefalico_cm
    FROM controles_crecimiento c
    WHERE ($1::DATE IS NULL OR c.fecha_control::DATE >= $1::DATE)
      AND ($2::DATE IS NULL OR c.fecha_control::DATE <= $2::DATE)
    ORDER BY c.id_paciente, c.fecha_control DESC, c.id_control DESC
  ),
  comunidades_reporte AS (
    SELECT id_comunidad, nombre
    FROM comunidades
    WHERE estado = 'activa'

    UNION ALL

    SELECT NULL::INTEGER AS id_comunidad,
           'Sin comunidad asignada'::VARCHAR(120) AS nombre
    WHERE EXISTS (
      SELECT 1
      FROM pacientes
      WHERE estado = 'activo'
        AND id_comunidad IS NULL
    )
  )
  SELECT
    co.id_comunidad,
    co.nombre AS comunidad,
    COUNT(DISTINCT p.id_paciente)::INTEGER AS pacientes_activos,
    COUNT(DISTINCT uc.id_paciente)::INTEGER AS pacientes_con_control,
    ROUND(AVG(uc.peso_kg)::NUMERIC, 2) AS peso_promedio_kg,
    ROUND(AVG(uc.talla_cm)::NUMERIC, 2) AS talla_promedio_cm,
    ROUND(AVG(uc.perimetro_cefalico_cm)::NUMERIC, 2) AS perimetro_cefalico_promedio_cm,
    MAX(uc.fecha_control) AS fecha_ultimo_control
  FROM comunidades_reporte co
  LEFT JOIN pacientes p
    ON p.id_comunidad IS NOT DISTINCT FROM co.id_comunidad
   AND p.estado = 'activo'
  LEFT JOIN ultimo_control uc
    ON uc.id_paciente = p.id_paciente
  GROUP BY co.id_comunidad, co.nombre
  ORDER BY co.nombre
`;

const obtenerBajoPeso = async (req, res) => {
  const rango = validarRangoFechas(req, res);
  if (!rango) return;

  try {
    const { rows } = await pool.query(SQL_BAJO_PESO, rango);
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error("Error en reporte de bajo peso:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el reporte de bajo peso." });
  }
};

const obtenerSobrepeso = async (req, res) => {
  const rango = validarRangoFechas(req, res);
  if (!rango) return;

  try {
    const { rows } = await pool.query(SQL_SOBREPESO, rango);
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error("Error en reporte de sobrepeso:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el reporte de sobrepeso." });
  }
};

const obtenerVacunasIncompletas = async (req, res) => {
  const rango = validarRangoFechas(req, res);
  if (!rango) return;

  try {
    const fechaCorte = rango[1];
    const { rows } = await pool.query(SQL_VACUNAS_INCOMPLETAS, [fechaCorte]);
    return res.json({
      success: true,
      fecha_corte: fechaCorte || null,
      criterio: "Se consideran todos los registros históricos para identificar si el paciente recibió alguna vacuna. Solo las vacunas activas del catálogo se utilizan para calcular dosis pendientes; las vacunas desactivadas no se cuentan como pendientes.",
      total: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error en reporte de vacunas incompletas:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el reporte de vacunas incompletas." });
  }
};

const obtenerCoberturaComunidad = async (req, res) => {
  const rango = validarRangoFechas(req, res);
  if (!rango) return;

  try {
    const { rows } = await pool.query(SQL_COBERTURA_COMUNIDAD, rango);
    return res.json({
      success: true,
      periodo: { fecha_inicio: rango[0], fecha_fin: rango[1] },
      definicion: "Porcentaje de pacientes activos de cada comunidad con al menos una vacunación registrada dentro del período seleccionado; no representa cumplimiento completo del esquema nacional.",
      data: rows,
    });
  } catch (error) {
    console.error("Error en cobertura por comunidad:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar la cobertura por comunidad." });
  }
};

const obtenerCrecimientoPromedioComunidad = async (req, res) => {
  const rango = validarRangoFechas(req, res);
  if (!rango) return;

  try {
    const { rows } = await pool.query(SQL_CRECIMIENTO_PROMEDIO, rango);
    return res.json({
      success: true,
      periodo: { fecha_inicio: rango[0], fecha_fin: rango[1] },
      definicion: "Promedio de la medición más reciente de cada paciente activo dentro del período seleccionado, agrupada por comunidad.",
      data: rows,
    });
  } catch (error) {
    console.error("Error en crecimiento promedio por comunidad:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el crecimiento promedio por comunidad." });
  }
};

const obtenerResumenReportes = async (req, res) => {
  const rango = validarRangoFechas(req, res);
  if (!rango) return;

  try {
    const [bajo, sobre, incompletas, cobertura, crecimiento] = await Promise.all([
      pool.query(SQL_BAJO_PESO, rango),
      pool.query(SQL_SOBREPESO, rango),
      pool.query(SQL_VACUNAS_INCOMPLETAS, [rango[1]]),
      pool.query(SQL_COBERTURA_COMUNIDAD, rango),
      pool.query(SQL_CRECIMIENTO_PROMEDIO, rango),
    ]);

    const [totalPacientes, totalComunidades, pacientesSinComunidad] = await Promise.all([
      pool.query("SELECT COUNT(*)::INTEGER AS total FROM pacientes WHERE estado = 'activo'"),
      pool.query("SELECT COUNT(*)::INTEGER AS total FROM comunidades WHERE estado = 'activa'"),
      pool.query("SELECT COUNT(*)::INTEGER AS total FROM pacientes WHERE estado = 'activo' AND id_comunidad IS NULL"),
    ]);

    return res.json({
      success: true,
      periodo: { fecha_inicio: rango[0], fecha_fin: rango[1] },
      indicadores: {
        pacientes_activos: totalPacientes.rows[0].total,
        bajo_peso: bajo.rows.length,
        sobrepeso: sobre.rows.length,
        vacunas_incompletas: incompletas.rows.length,
        comunidades: totalComunidades.rows[0].total,
        pacientes_sin_comunidad: pacientesSinComunidad.rows[0].total,
      },
      bajo_peso: bajo.rows,
      sobrepeso: sobre.rows,
      vacunas_incompletas: incompletas.rows,
      cobertura_comunidad: cobertura.rows,
      crecimiento_promedio_comunidad: crecimiento.rows,
      definiciones: {
        bajo_peso: "Última evaluación del indicador OMS peso_edad con estado peso_bajo o peso_muy_bajo dentro del período.",
        sobrepeso: "Última evaluación del indicador OMS peso_talla con estado sobrepeso u obesidad dentro del período.",
        cobertura: "Pacientes activos con al menos una vacunación registrada dentro del período dividido entre pacientes activos de la comunidad.",
        crecimiento: "Promedio de la medición más reciente por paciente dentro del período.",
      },
    });
  } catch (error) {
    console.error("Error en resumen de reportes:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el resumen de reportes." });
  }
};

module.exports = {
  obtenerResumenReportes,
  obtenerBajoPeso,
  obtenerSobrepeso,
  obtenerVacunasIncompletas,
  obtenerCoberturaComunidad,
  obtenerCrecimientoPromedioComunidad,
};
