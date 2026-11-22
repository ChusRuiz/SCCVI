const pool = require("../config/db");

const TIPOS = ["jornada_vacunacion", "control_medico", "informativa"];
const FILTROS_VACUNACION = ["todos", "completa", "pendiente"];

class ErrorCampana extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

function idPositivo(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorCampana("El identificador de comunidad no es válido.");
  }
  return numero;
}

function enteroOpcional(valor, campo) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new ErrorCampana(`${campo} debe ser un entero mayor o igual a cero.`);
  }
  return numero;
}

function normalizarFiltros(body = {}) {
  const idComunidad = idPositivo(body.id_comunidad);
  const edadMin = enteroOpcional(body.edad_min_meses, "La edad mínima");
  const edadMax = enteroOpcional(body.edad_max_meses, "La edad máxima");
  const filtroVacunacion = body.filtro_vacunacion || "todos";

  if (edadMin !== null && edadMax !== null && edadMin > edadMax) {
    throw new ErrorCampana("La edad mínima no puede superar la edad máxima.");
  }
  if (!FILTROS_VACUNACION.includes(filtroVacunacion)) {
    throw new ErrorCampana("El filtro de vacunación no es válido.");
  }

  return {
    id_comunidad: idComunidad,
    edad_min_meses: edadMin,
    edad_max_meses: edadMax,
    filtro_vacunacion: filtroVacunacion,
  };
}

function normalizarDatosCampana(body = {}) {
  const titulo = String(body.titulo || "").trim();
  const tipo = String(body.tipo || "").trim();
  const mensaje = String(body.mensaje || "").trim();
  const descripcion = String(body.descripcion || "").trim() || null;
  const filtros = normalizarFiltros(body);

  if (!titulo || titulo.length > 150) {
    throw new ErrorCampana("El título es obligatorio y no debe superar 150 caracteres.");
  }
  if (!TIPOS.includes(tipo)) {
    throw new ErrorCampana("El tipo de campaña no es válido.");
  }
  if (!mensaje || mensaje.length > 3000) {
    throw new ErrorCampana("El mensaje es obligatorio y no debe superar 3000 caracteres.");
  }
  if (descripcion && descripcion.length > 2000) {
    throw new ErrorCampana("La descripción no debe superar 2000 caracteres.");
  }

  let fechaProgramada = new Date();
  if (body.fecha_programada) {
    fechaProgramada = new Date(body.fecha_programada);
    if (Number.isNaN(fechaProgramada.getTime())) {
      throw new ErrorCampana("La fecha programada no tiene un formato válido.");
    }
    if (fechaProgramada.getTime() < Date.now() - 60_000) {
      throw new ErrorCampana("La fecha programada no puede estar en el pasado.");
    }
  }

  return {
    titulo,
    tipo,
    mensaje,
    descripcion,
    ...filtros,
    fecha_programada: fechaProgramada,
  };
}

// Devuelve pacientes activos que cumplen comunidad, edad y estado operativo de vacunación.
async function obtenerPacientesSegmento(db, filtros) {
  const resultado = await db.query(
    `
      SELECT
        p.id_paciente,
        p.nombres,
        p.apellidos,
        p.id_comunidad,
        (
          EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento)) * 12
          + EXTRACT(MONTH FROM age(CURRENT_DATE, p.fecha_nacimiento))
        )::INTEGER AS edad_meses,
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM vacunaciones v
            WHERE v.id_paciente = p.id_paciente
          ) THEN 'pendiente'
          WHEN EXISTS (
            SELECT 1
            FROM vacunaciones v
            WHERE v.id_paciente = p.id_paciente
              AND v.proxima_dosis IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM vacunaciones v2
                WHERE v2.id_paciente = v.id_paciente
                  AND v2.id_vacuna = v.id_vacuna
                  AND v2.fecha_aplicacion >= v.proxima_dosis
              )
          ) THEN 'pendiente'
          ELSE 'completa'
        END AS estado_vacunacion_operativo
      FROM pacientes p
      WHERE p.estado = 'activo'
        AND p.fecha_nacimiento IS NOT NULL
        AND p.fecha_nacimiento <= CURRENT_DATE
        AND ($1::INTEGER IS NULL OR p.id_comunidad = $1)
        AND (
          $2::INTEGER IS NULL OR
          (EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento)) * 12
            + EXTRACT(MONTH FROM age(CURRENT_DATE, p.fecha_nacimiento))) >= $2
        )
        AND (
          $3::INTEGER IS NULL OR
          (EXTRACT(YEAR FROM age(CURRENT_DATE, p.fecha_nacimiento)) * 12
            + EXTRACT(MONTH FROM age(CURRENT_DATE, p.fecha_nacimiento))) <= $3
        )
      ORDER BY p.apellidos, p.nombres
    `,
    [filtros.id_comunidad, filtros.edad_min_meses, filtros.edad_max_meses]
  );

  if (filtros.filtro_vacunacion === "todos") return resultado.rows;
  return resultado.rows.filter(
    (p) => p.estado_vacunacion_operativo === filtros.filtro_vacunacion
  );
}

async function obtenerContactosPrincipales(db, idsPacientes) {
  if (!idsPacientes.length) return [];

  const resultado = await db.query(
    `
      SELECT DISTINCT ON (pf.id_padre)
        pf.id_padre,
        pf.nombres,
        pf.apellidos,
        pf.correo,
        pf.telegram_chat_id,
        pf.canal_preferido
      FROM padres_pacientes pp
      INNER JOIN padres_familia pf
        ON pf.id_padre = pp.id_padre
      WHERE pp.id_paciente = ANY($1::INTEGER[])
        AND pp.es_contacto_principal = TRUE
        AND pf.estado = 'activo'
      ORDER BY pf.id_padre, pp.id_paciente
    `,
    [idsPacientes]
  );

  return resultado.rows;
}

function clasificarDestinatarios(contactos) {
  const validos = [];
  let canalNoSoportado = 0;
  let sinDestinatario = 0;

  for (const padre of contactos) {
    const canal = String(padre.canal_preferido || "").trim().toLowerCase();
    let destinatario = null;

    if (canal === "telegram") {
      destinatario = padre.telegram_chat_id;
    } else if (canal === "email") {
      destinatario = padre.correo;
    } else {
      canalNoSoportado++;
      continue;
    }

    if (!destinatario || !String(destinatario).trim()) {
      sinDestinatario++;
      continue;
    }

    validos.push({
      id_padre: padre.id_padre,
      nombres: padre.nombres,
      canal,
      destinatario: String(destinatario).trim(),
    });
  }

  return { validos, canalNoSoportado, sinDestinatario };
}

async function prepararSegmento(db, filtros) {
  if (filtros.id_comunidad) {
    const comunidad = await db.query(
      `SELECT id_comunidad FROM comunidades
       WHERE id_comunidad = $1 AND estado = 'activa'`,
      [filtros.id_comunidad]
    );
    if (!comunidad.rowCount) {
      throw new ErrorCampana("La comunidad seleccionada no existe o está inactiva.", 404);
    }
  }

  const pacientes = await obtenerPacientesSegmento(db, filtros);
  const idsPacientes = pacientes.map((p) => p.id_paciente);
  const contactos = await obtenerContactosPrincipales(db, idsPacientes);
  const clasificacion = clasificarDestinatarios(contactos);

  const pacientesConContacto = new Set();
  if (idsPacientes.length) {
    const asociados = await db.query(
      `SELECT DISTINCT pp.id_paciente
       FROM padres_pacientes pp
       INNER JOIN padres_familia pf ON pf.id_padre = pp.id_padre
       WHERE pp.id_paciente = ANY($1::INTEGER[])
         AND pp.es_contacto_principal = TRUE
         AND pf.estado = 'activo'`,
      [idsPacientes]
    );
    asociados.rows.forEach((r) => pacientesConContacto.add(r.id_paciente));
  }

  return {
    pacientes,
    contactos,
    destinatarios: clasificacion.validos,
    resumen: {
      pacientes_encontrados: pacientes.length,
      contactos_principales: contactos.length,
      destinatarios_validos: clasificacion.validos.length,
      email: clasificacion.validos.filter((d) => d.canal === "email").length,
      telegram: clasificacion.validos.filter((d) => d.canal === "telegram").length,
      sin_contacto_principal: idsPacientes.filter((id) => !pacientesConContacto.has(id)).length,
      sin_destinatario: clasificacion.sinDestinatario,
      canal_no_soportado: clasificacion.canalNoSoportado,
    },
  };
}

const previsualizarCampana = async (req, res) => {
  try {
    const filtros = normalizarFiltros(req.body);
    const segmento = await prepararSegmento(pool, filtros);

    return res.json({
      success: true,
      filtros,
      resumen: segmento.resumen,
      criterio_vacunacion:
        "Pendiente: sin vacunaciones registradas o con una próxima dosis sin una aplicación posterior de la misma vacuna. Completa: tiene registros y no presenta próximas dosis pendientes registradas.",
    });
  } catch (error) {
    console.error("Error previsualizando campaña:", error);
    return res.status(error.status || 500).json({
      success: false,
      mensaje: error.message || "No se pudo previsualizar la campaña.",
    });
  }
};

const crearCampana = async (req, res) => {
  const client = await pool.connect();
  try {
    const datos = normalizarDatosCampana(req.body);
    await client.query("BEGIN");

    const segmento = await prepararSegmento(client, datos);
    if (!segmento.destinatarios.length) {
      throw new ErrorCampana(
        "No hay destinatarios con un contacto principal activo y un canal Email o Telegram configurado.",
        409
      );
    }

    const usuarioId = req.usuario?.id || req.usuario?.id_usuario || null;
    const insertCampana = await client.query(
      `
        INSERT INTO campanas (
          titulo, tipo, descripcion, mensaje, id_comunidad,
          edad_min_meses, edad_max_meses, filtro_vacunacion,
          fecha_programada, estado, destinatarios_total,
          id_usuario_creador
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'programada',$10,$11)
        RETURNING *
      `,
      [
        datos.titulo,
        datos.tipo,
        datos.descripcion,
        datos.mensaje,
        datos.id_comunidad,
        datos.edad_min_meses,
        datos.edad_max_meses,
        datos.filtro_vacunacion,
        datos.fecha_programada,
        segmento.destinatarios.length,
        usuarioId,
      ]
    );

    const campana = insertCampana.rows[0];
    let creadas = 0;

    for (const destinatario of segmento.destinatarios) {
      const saludo = destinatario.nombres ? `Hola ${destinatario.nombres}. ` : "Hola. ";
      const texto = `${saludo}${datos.titulo}. ${datos.mensaje}\n\nCentro de salud - SCCVI`;
      const asunto = `SCCVI: ${datos.titulo}`;

      const insertNotificacion = await client.query(
        `
          INSERT INTO notificaciones (
            id_alerta, id_campana, id_padre, canal, destinatario,
            estado, asunto, mensaje, fecha_programada
          )
          VALUES (NULL, $1, $2, $3, $4, 'pendiente', $5, $6, $7)
          ON CONFLICT (id_campana, id_padre, canal)
            WHERE id_campana IS NOT NULL
          DO NOTHING
          RETURNING id_notificacion
        `,
        [
          campana.id_campana,
          destinatario.id_padre,
          destinatario.canal,
          destinatario.destinatario,
          asunto,
          texto,
          datos.fecha_programada,
        ]
      );

      if (insertNotificacion.rowCount) creadas++;
    }

    await client.query(
      `UPDATE campanas
       SET notificaciones_creadas = $1, actualizado_en = NOW()
       WHERE id_campana = $2`,
      [creadas, campana.id_campana]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      mensaje: "Campaña creada y notificaciones agregadas a la cola.",
      campana: {
        ...campana,
        notificaciones_creadas: creadas,
      },
      resumen: segmento.resumen,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creando campaña:", error);
    return res.status(error.status || 500).json({
      success: false,
      mensaje: error.message || "No se pudo crear la campaña.",
    });
  } finally {
    client.release();
  }
};

const listarCampanas = async (req, res) => {
  try {
    const limite = Math.min(Math.max(Number(req.query.limite) || 20, 1), 100);
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const offset = (pagina - 1) * limite;

    const resultado = await pool.query(
      `
        SELECT
          c.*,
          co.nombre AS comunidad_nombre,
          u.nombre AS creado_por,
          COALESCE(s.total, 0)::INTEGER AS total_notificaciones,
          COALESCE(s.pendientes, 0)::INTEGER AS pendientes,
          COALESCE(s.procesando, 0)::INTEGER AS procesando,
          COALESCE(s.enviadas, 0)::INTEGER AS enviadas,
          COALESCE(s.errores, 0)::INTEGER AS errores,
          CASE
            WHEN c.estado = 'cancelada' THEN 'cancelada'
            WHEN COALESCE(s.pendientes, 0) + COALESCE(s.procesando, 0) > 0
              AND COALESCE(s.enviadas, 0) > 0 THEN 'enviando'
            WHEN COALESCE(s.pendientes, 0) + COALESCE(s.procesando, 0) > 0 THEN 'programada'
            WHEN COALESCE(s.errores, 0) > 0 AND COALESCE(s.enviadas, 0) > 0 THEN 'parcial'
            WHEN COALESCE(s.errores, 0) > 0 THEN 'fallida'
            WHEN COALESCE(s.total, 0) > 0 THEN 'enviada'
            ELSE c.estado
          END AS estado_actual
        FROM campanas c
        LEFT JOIN comunidades co ON co.id_comunidad = c.id_comunidad
        LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario_creador
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE n.estado = 'pendiente') AS pendientes,
            COUNT(*) FILTER (WHERE n.estado = 'procesando') AS procesando,
            COUNT(*) FILTER (WHERE n.estado = 'enviada') AS enviadas,
            COUNT(*) FILTER (WHERE n.estado = 'error') AS errores
          FROM notificaciones n
          WHERE n.id_campana = c.id_campana
        ) s ON TRUE
        ORDER BY c.creado_en DESC
        LIMIT $1 OFFSET $2
      `,
      [limite, offset]
    );

    const conteo = await pool.query("SELECT COUNT(*)::INTEGER AS total FROM campanas");
    const total = conteo.rows[0].total;

    return res.json({
      success: true,
      data: resultado.rows,
      paginacion: {
        pagina,
        limite,
        total,
        total_paginas: Math.ceil(total / limite),
      },
    });
  } catch (error) {
    console.error("Error listando campañas:", error);
    return res.status(500).json({
      success: false,
      mensaje: "No se pudieron consultar las campañas.",
    });
  }
};

const obtenerCampana = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, mensaje: "Identificador no válido." });
    }

    const resultado = await pool.query(
      `
        SELECT
          c.*,
          co.nombre AS comunidad_nombre,
          u.nombre AS creado_por,
          COALESCE(s.total, 0)::INTEGER AS total_notificaciones,
          COALESCE(s.pendientes, 0)::INTEGER AS pendientes,
          COALESCE(s.enviando, 0)::INTEGER AS procesando,
          COALESCE(s.enviadas, 0)::INTEGER AS enviadas,
          COALESCE(s.errores, 0)::INTEGER AS errores
        FROM campanas c
        LEFT JOIN comunidades co ON co.id_comunidad = c.id_comunidad
        LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario_creador
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
            COUNT(*) FILTER (WHERE estado = 'procesando') AS enviando,
            COUNT(*) FILTER (WHERE estado = 'enviada') AS enviadas,
            COUNT(*) FILTER (WHERE estado = 'error') AS errores
          FROM notificaciones
          WHERE id_campana = c.id_campana
        ) s ON TRUE
        WHERE c.id_campana = $1
      `,
      [id]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({ success: false, mensaje: "Campaña no encontrada." });
    }

    const destinatarios = await pool.query(
      `
        SELECT
          n.id_notificacion,
          n.id_padre,
          pf.nombres || ' ' || pf.apellidos AS padre,
          n.canal,
          n.destinatario,
          n.estado,
          n.intentos,
          n.error_detalle,
          n.fecha_programada,
          n.enviado_en
        FROM notificaciones n
        INNER JOIN padres_familia pf ON pf.id_padre = n.id_padre
        WHERE n.id_campana = $1
        ORDER BY pf.apellidos, pf.nombres
      `,
      [id]
    );

    return res.json({
      success: true,
      campana: resultado.rows[0],
      destinatarios: destinatarios.rows,
    });
  } catch (error) {
    console.error("Error obteniendo campaña:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo consultar la campaña." });
  }
};

module.exports = {
  previsualizarCampana,
  crearCampana,
  listarCampanas,
  obtenerCampana,
};
