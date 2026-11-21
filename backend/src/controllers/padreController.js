
const pool = require("../config/db");

// ============================================
// ERRORES CONTROLADOS
// ============================================

class ErrorControlado extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

// ============================================
// VALIDACIONES GENERALES
// ============================================

function validarId(id) {
  const numero = Number(id);
  return Number.isInteger(numero) && numero > 0;
}

function validarDatosPadre(body) {
  const nombres = String(body.nombres || "").trim();
  const apellidos = String(body.apellidos || "").trim();

  const idComunidad = Number(body.id_comunidad);
  const dpiIngresado = String(body.dpi || "").trim();

  const telefono = String(body.telefono || "").trim() || null;
  const correo = String(body.correo || "").trim().toLowerCase() || null;

  const canalPreferido = body.canal_preferido || "email";

  if (!nombres || !apellidos) {
    throw new ErrorControlado(
      "Los nombres y apellidos son obligatorios"
    );
  }

  if (nombres.length > 100 || apellidos.length > 100) {
    throw new ErrorControlado(
      "Los nombres y apellidos no pueden superar los 100 caracteres"
    );
  }

  if (!validarId(idComunidad)) {
    throw new ErrorControlado(
      "Debes seleccionar una comunidad válida"
    );
  }

  // DPI guatemalteco: 13 dígitos
  let dpi = null;

  if (dpiIngresado) {
    if (!/^[0-9\s-]+$/.test(dpiIngresado)) {
      throw new ErrorControlado(
        "El DPI debe contener únicamente números"
      );
    }

    dpi = dpiIngresado.replace(/\D/g, "");

    if (dpi.length !== 13) {
      throw new ErrorControlado(
        "El DPI debe contener exactamente 13 dígitos"
      );
    }
  }

  // Teléfono
  if (telefono && !/^\+?[\d\s()-]{8,20}$/.test(telefono)) {
    throw new ErrorControlado(
      "El número de teléfono no tiene un formato válido"
    );
  }

  if (telefono && telefono.length > 25) {
    throw new ErrorControlado(
      "El teléfono no puede superar los 25 caracteres"
    );
  }

  // Correo electrónico
  if (
    correo &&
    (
      correo.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
    )
  ) {
    throw new ErrorControlado(
      "El correo electrónico no tiene un formato válido"
    );
  }

  // Canal de notificación
  if (!["email", "telegram", "whatsapp"].includes(canalPreferido)) {
    throw new ErrorControlado(
      "El canal preferido debe ser email, telegram o whatsapp"
    );
  }

  return {
    nombres,
    apellidos,
    id_comunidad: idComunidad,
    dpi,
    telefono,
    correo,
    canal_preferido: canalPreferido,
  };
}

// ============================================
// VALIDAR ASOCIACIONES PADRE - PACIENTES
// ============================================

function normalizarAsociaciones(pacientes) {
  if (!Array.isArray(pacientes)) {
    throw new ErrorControlado(
      "Las asociaciones de pacientes deben enviarse como un arreglo"
    );
  }

  const asociaciones = pacientes.map((paciente) => {
    if (
      !paciente ||
      typeof paciente !== "object" ||
      Array.isArray(paciente)
    ) {
      throw new ErrorControlado(
        "Una asociación de paciente no tiene un formato válido"
      );
    }

    const idPaciente = Number(paciente.id_paciente);

    const parentesco = String(
      paciente.parentesco || "Encargado"
    ).trim();

    const esPrincipal =
      paciente.es_contacto_principal === true;

    if (!validarId(idPaciente)) {
      throw new ErrorControlado(
        "Uno de los identificadores de paciente no es válido"
      );
    }

    if (!parentesco || parentesco.length > 40) {
      throw new ErrorControlado(
        "El parentesco debe tener entre 1 y 40 caracteres"
      );
    }

    if (
      paciente.es_contacto_principal !== undefined &&
      typeof paciente.es_contacto_principal !== "boolean"
    ) {
      throw new ErrorControlado(
        "El contacto principal debe ser verdadero o falso"
      );
    }

    return {
      id_paciente: idPaciente,
      parentesco,
      es_contacto_principal: esPrincipal,
    };
  });

  const ids = asociaciones.map(
    (asociacion) => asociacion.id_paciente
  );

  if (new Set(ids).size !== ids.length) {
    throw new ErrorControlado(
      "No puedes asociar dos veces al mismo paciente"
    );
  }

  return asociaciones;
}

// ============================================
// VALIDAR COMUNIDAD ACTIVA
// ============================================

async function validarComunidadActiva(client, idComunidad) {
  const resultado = await client.query(
    `SELECT id_comunidad
     FROM comunidades
     WHERE id_comunidad = $1
       AND estado = 'activa'`,
    [idComunidad]
  );

  if (!resultado.rows.length) {
    throw new ErrorControlado(
      "La comunidad no existe o se encuentra inactiva"
    );
  }
}

// ============================================
// SINCRONIZAR ENCARGADO DEL PACIENTE
// ============================================

async function sincronizarEncargadoPaciente(client, idPaciente) {
  // Bloquear al paciente durante la sincronización
  const pacienteResult = await client.query(
    `SELECT id_paciente
     FROM pacientes
     WHERE id_paciente = $1
     FOR UPDATE`,
    [idPaciente]
  );

  if (!pacienteResult.rows.length) {
    return;
  }

  // Buscar el contacto principal activo.
  // Si ya no existe, se selecciona el primer responsable activo.
  const resultado = await client.query(
    `SELECT
        pf.id_padre,
        pf.nombres,
        pf.apellidos,
        pf.telefono

     FROM padres_pacientes pp

     INNER JOIN padres_familia pf
       ON pp.id_padre = pf.id_padre

     WHERE pp.id_paciente = $1
       AND pf.estado = 'activo'

     ORDER BY
       pp.es_contacto_principal DESC,
       pp.creado_en ASC,
       pp.id_padre ASC

     LIMIT 1`,
    [idPaciente]
  );

  const principal = resultado.rows[0] || null;

  // Retirar la marca de contacto principal anterior
  await client.query(
    `UPDATE padres_pacientes
     SET es_contacto_principal = FALSE
     WHERE id_paciente = $1
       AND es_contacto_principal = TRUE`,
    [idPaciente]
  );

  if (!principal) {
    // Si no quedan responsables activos, limpiar encargado
    await client.query(
      `UPDATE pacientes
       SET nombre_encargado = NULL,
           telefono_encargado = NULL
       WHERE id_paciente = $1`,
      [idPaciente]
    );

    return;
  }

  // Designar el contacto principal seleccionado
  await client.query(
    `UPDATE padres_pacientes
     SET es_contacto_principal = TRUE
     WHERE id_padre = $1
       AND id_paciente = $2`,
    [principal.id_padre, idPaciente]
  );

  // Actualizar campos antiguos de pacientes
  await client.query(
    `UPDATE pacientes
     SET nombre_encargado = $1,
         telefono_encargado = $2
     WHERE id_paciente = $3`,
    [
      `${principal.nombres} ${principal.apellidos}`.trim(),
      principal.telefono,
      idPaciente,
    ]
  );
}

// ============================================
// GUARDAR ASOCIACIONES
// ============================================

async function guardarAsociaciones(
  client,
  idPadre,
  pacientes,
  reemplazar = false
) {
  const asociaciones = normalizarAsociaciones(pacientes);

  // Validar que los pacientes existan y estén activos
  if (asociaciones.length > 0) {
    const ids = asociaciones.map(
      (asociacion) => asociacion.id_paciente
    );

    const pacientesResult = await client.query(
      `SELECT id_paciente
       FROM pacientes
       WHERE id_paciente = ANY($1::INTEGER[])
         AND estado = 'activo'
       ORDER BY id_paciente
       FOR UPDATE`,
      [ids]
    );

    if (pacientesResult.rows.length !== ids.length) {
      throw new ErrorControlado(
        "Uno o varios pacientes no existen o están inactivos"
      );
    }
  }

  if (reemplazar) {
    await client.query(
      `DELETE FROM padres_pacientes
       WHERE id_padre = $1`,
      [idPadre]
    );
  }

  for (const asociacion of asociaciones) {
    // Retirar la marca anterior si se asignará
    // este padre como contacto principal.
    if (asociacion.es_contacto_principal) {
      await client.query(
        `UPDATE padres_pacientes
         SET es_contacto_principal = FALSE
         WHERE id_paciente = $1`,
        [asociacion.id_paciente]
      );
    }

    await client.query(
      `INSERT INTO padres_pacientes (
          id_padre,
          id_paciente,
          parentesco,
          es_contacto_principal
       )
       VALUES ($1, $2, $3, $4)

       ON CONFLICT (id_padre, id_paciente)
       DO UPDATE SET
          parentesco = EXCLUDED.parentesco,
          es_contacto_principal =
            EXCLUDED.es_contacto_principal`,
      [
        idPadre,
        asociacion.id_paciente,
        asociacion.parentesco,
        asociacion.es_contacto_principal,
      ]
    );
  }

  return asociaciones;
}

// ============================================
// SINCRONIZAR TODOS LOS PACIENTES DE UN PADRE
// ============================================

async function sincronizarPacientesDePadre(client, idPadre) {
  const resultado = await client.query(
    `SELECT id_paciente
     FROM padres_pacientes
     WHERE id_padre = $1
     ORDER BY id_paciente`,
    [idPadre]
  );

  for (const fila of resultado.rows) {
    await sincronizarEncargadoPaciente(
      client,
      fila.id_paciente
    );
  }
}

// ============================================
// MANEJAR ERRORES
// ============================================

function manejarErrorBD(res, error, contexto) {
  console.error(`${contexto}:`, error);

  if (error instanceof ErrorControlado) {
    return res.status(error.status).json({
      mensaje: error.message,
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      mensaje:
        "El DPI ya está registrado o existe un conflicto en el contacto principal",
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      mensaje: "Existe una relación con un registro que no es válido",
    });
  }

  return res.status(500).json({
    mensaje: contexto,
    detalle: error.message,
  });
}

// ============================================
// LISTAR Y BUSCAR PADRES
// ============================================

const listarPadres = async (req, res) => {
  try {
    const {
      buscar = "",
      estado = "todas",
      comunidad = "",
    } = req.query;

    if (!["todas", "activo", "inactivo"].includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado de padre no válido",
      });
    }

    let idComunidad = null;

    if (comunidad !== "") {
      if (!validarId(comunidad)) {
        return res.status(400).json({
          mensaje: "Identificador de comunidad no válido",
        });
      }

      idComunidad = Number(comunidad);
    }

    const resultado = await pool.query(
      `SELECT
          pf.*,
          c.nombre AS comunidad_nombre,

          (
            SELECT COUNT(*)
            FROM padres_pacientes pp
            WHERE pp.id_padre = pf.id_padre
          )::INTEGER AS total_ninos

       FROM padres_familia pf

       INNER JOIN comunidades c
          ON pf.id_comunidad = c.id_comunidad

       WHERE
          ($1 = 'todas' OR pf.estado = $1)

          AND (
            $2::INTEGER IS NULL
            OR pf.id_comunidad = $2
          )

          AND (
            pf.nombres ILIKE $3
            OR pf.apellidos ILIKE $3
            OR COALESCE(pf.dpi, '') ILIKE $3
            OR COALESCE(pf.telefono, '') ILIKE $3
            OR COALESCE(pf.correo, '') ILIKE $3
            OR c.nombre ILIKE $3
          )

       ORDER BY pf.apellidos ASC, pf.nombres ASC`,
      [
        estado,
        idComunidad,
        `%${String(buscar).trim()}%`,
      ]
    );

    return res.json(resultado.rows);

  } catch (error) {
    return manejarErrorBD(
      res,
      error,
      "Error al consultar padres de familia"
    );
  }
};

// ============================================
// CONSULTAR PADRE Y SUS NIÑOS
// ============================================

const obtenerPadre = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de padre no válido",
      });
    }

    const resultado = await pool.query(
      `SELECT
          pf.*,
          c.nombre AS comunidad_nombre,

          COALESCE(
            hijos.pacientes,
            '[]'::JSON
          ) AS pacientes

       FROM padres_familia pf

       INNER JOIN comunidades c
          ON pf.id_comunidad = c.id_comunidad

       LEFT JOIN LATERAL (
          SELECT
            json_agg(
              json_build_object(
                'id_paciente', p.id_paciente,
                'nombres', p.nombres,
                'apellidos', p.apellidos,
                'fecha_nacimiento', p.fecha_nacimiento,
                'sexo', p.sexo,
                'parentesco', pp.parentesco,
                'es_contacto_principal',
                  pp.es_contacto_principal
              )
              ORDER BY p.apellidos, p.nombres
            ) AS pacientes

          FROM padres_pacientes pp

          INNER JOIN pacientes p
            ON pp.id_paciente = p.id_paciente

          WHERE pp.id_padre = pf.id_padre
       ) hijos ON TRUE

       WHERE pf.id_padre = $1`,
      [id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        mensaje: "Padre de familia no encontrado",
      });
    }

    return res.json(resultado.rows[0]);

  } catch (error) {
    return manejarErrorBD(
      res,
      error,
      "Error al consultar padre de familia"
    );
  }
};

// ============================================
// REGISTRAR PADRE
// ============================================

const crearPadre = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const datos = validarDatosPadre(req.body);

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    await validarComunidadActiva(
      client,
      datos.id_comunidad
    );

    const resultado = await client.query(
      `INSERT INTO padres_familia (
          id_comunidad,
          nombres,
          apellidos,
          dpi,
          telefono,
          correo,
          canal_preferido
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        datos.id_comunidad,
        datos.nombres,
        datos.apellidos,
        datos.dpi,
        datos.telefono,
        datos.correo,
        datos.canal_preferido,
      ]
    );

    const padre = resultado.rows[0];

    let asociaciones = [];

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "pacientes"
      )
    ) {
      asociaciones = await guardarAsociaciones(
        client,
        padre.id_padre,
        req.body.pacientes,
        true
      );

      const ids = [
        ...new Set(
          asociaciones.map((item) => item.id_paciente)
        ),
      ];

      for (const idPaciente of ids) {
        await sincronizarEncargadoPaciente(
          client,
          idPaciente
        );
      }
    }

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.status(201).json({
      mensaje: "Padre de familia registrado correctamente",
      padre,
      asociaciones,
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al registrar padre de familia"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// ACTUALIZAR PADRE
// ============================================

const actualizarPadre = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de padre no válido",
      });
    }

    const datos = validarDatosPadre(req.body);

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    // Guardar las asociaciones anteriores
    const anteriores = await client.query(
      `SELECT id_paciente
       FROM padres_pacientes
       WHERE id_padre = $1`,
      [id]
    );

    await validarComunidadActiva(
      client,
      datos.id_comunidad
    );

    const resultado = await client.query(
      `UPDATE padres_familia
       SET
          id_comunidad = $1,
          nombres = $2,
          apellidos = $3,
          dpi = $4,
          telefono = $5,
          correo = $6,
          canal_preferido = $7

       WHERE id_padre = $8
       RETURNING *`,
      [
        datos.id_comunidad,
        datos.nombres,
        datos.apellidos,
        datos.dpi,
        datos.telefono,
        datos.correo,
        datos.canal_preferido,
        id,
      ]
    );

    if (!resultado.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Padre de familia no encontrado",
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "pacientes"
      )
    ) {
      await guardarAsociaciones(
        client,
        Number(id),
        req.body.pacientes,
        true
      );
    }

    // Recuperar las asociaciones actuales
    const actuales = await client.query(
      `SELECT id_paciente
       FROM padres_pacientes
       WHERE id_padre = $1`,
      [id]
    );

    // Sincronizar pacientes anteriores y actuales.
    // También actualiza sus datos si cambió el nombre o teléfono.
    const pacientesParaSincronizar = new Set([
      ...anteriores.rows.map((r) => Number(r.id_paciente)),
      ...actuales.rows.map((r) => Number(r.id_paciente)),
    ]);

    for (const idPaciente of pacientesParaSincronizar) {
      await sincronizarEncargadoPaciente(
        client,
        idPaciente
      );
    }

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.json({
      mensaje: "Padre de familia actualizado correctamente",
      padre: resultado.rows[0],
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al actualizar padre de familia"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// ASOCIAR PACIENTE A UN PADRE
// ============================================

const asociarPaciente = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de padre no válido",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    const padreResult = await client.query(
      `SELECT id_padre
       FROM padres_familia
       WHERE id_padre = $1
         AND estado = 'activo'
       FOR UPDATE`,
      [id]
    );

    if (!padreResult.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Padre no encontrado o inactivo",
      });
    }

    const asociaciones = await guardarAsociaciones(
      client,
      Number(id),
      [req.body],
      false
    );

    await sincronizarEncargadoPaciente(
      client,
      asociaciones[0].id_paciente
    );

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.status(201).json({
      mensaje: "Paciente asociado correctamente al padre",
      asociacion: asociaciones[0],
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al asociar paciente al padre"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// DESASOCIAR PACIENTE DE UN PADRE
// ============================================

const desasociarPaciente = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id, idPaciente } = req.params;

    if (!validarId(id) || !validarId(idPaciente)) {
      return res.status(400).json({
        mensaje: "Identificadores de padre o paciente no válidos",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    const resultado = await client.query(
      `DELETE FROM padres_pacientes
       WHERE id_padre = $1
         AND id_paciente = $2
       RETURNING id_padre, id_paciente`,
      [id, idPaciente]
    );

    if (!resultado.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "No existe esa asociación entre padre y paciente",
      });
    }

    await sincronizarEncargadoPaciente(
      client,
      Number(idPaciente)
    );

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.json({
      mensaje: "Paciente desasociado correctamente",
      asociacion: resultado.rows[0],
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al desasociar paciente"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// DESIGNAR CONTACTO PRINCIPAL
// ============================================

const marcarContactoPrincipal = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id, idPaciente } = req.params;

    if (!validarId(id) || !validarId(idPaciente)) {
      return res.status(400).json({
        mensaje: "Identificadores de padre o paciente no válidos",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    // Bloquear el paciente para evitar cambios simultáneos.
    const pacienteResult = await client.query(
      `SELECT id_paciente
       FROM pacientes
       WHERE id_paciente = $1
       FOR UPDATE`,
      [idPaciente]
    );

    if (!pacienteResult.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    // Verificar que el padre esté activo y asociado.
    const asociacion = await client.query(
      `SELECT pp.id_padre, pp.id_paciente
       FROM padres_pacientes pp
       INNER JOIN padres_familia pf
          ON pf.id_padre = pp.id_padre

       WHERE pp.id_padre = $1
         AND pp.id_paciente = $2
         AND pf.estado = 'activo'`,
      [id, idPaciente]
    );

    if (!asociacion.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "El padre no está asociado o se encuentra inactivo",
      });
    }

    // Retirar contacto anterior
    await client.query(
      `UPDATE padres_pacientes
       SET es_contacto_principal = FALSE
       WHERE id_paciente = $1`,
      [idPaciente]
    );

    // Asignar nuevo contacto principal
    await client.query(
      `UPDATE padres_pacientes
       SET es_contacto_principal = TRUE
       WHERE id_padre = $1
         AND id_paciente = $2`,
      [id, idPaciente]
    );

    // Sincronizar nombre y teléfono del encargado
    await sincronizarEncargadoPaciente(
      client,
      Number(idPaciente)
    );

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.json({
      mensaje: "Contacto principal actualizado correctamente",
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al actualizar contacto principal"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// DESACTIVAR PADRE
// ============================================

const desactivarPadre = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de padre no válido",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    const resultado = await client.query(
      `UPDATE padres_familia
       SET estado = 'inactivo'
       WHERE id_padre = $1
       RETURNING *`,
      [id]
    );

    if (!resultado.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Padre de familia no encontrado",
      });
    }

    // Sincronizar todos sus niños.
    // Si era contacto principal, otro responsable activo
    // ocupará ese lugar cuando exista.
    await sincronizarPacientesDePadre(
      client,
      Number(id)
    );

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.json({
      mensaje: "Padre desactivado correctamente",
      padre: resultado.rows[0],
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al desactivar padre"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// REACTIVAR PADRE
// ============================================

const activarPadre = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de padre no válido",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    const resultado = await client.query(
      `UPDATE padres_familia
       SET estado = 'activo'
       WHERE id_padre = $1
       RETURNING *`,
      [id]
    );

    if (!resultado.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Padre de familia no encontrado",
      });
    }

    // Sincronizar para actualizar el encargado si corresponde.
    await sincronizarPacientesDePadre(
      client,
      Number(id)
    );

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.json({
      mensaje: "Padre reactivado correctamente",
      padre: resultado.rows[0],
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      await client.query("ROLLBACK");
    }

    return manejarErrorBD(
      res,
      error,
      "Error al reactivar padre"
    );

  } finally {
    if (client) client.release();
  }
};

// ============================================
// EXPORTAR CONTROLADOR
// ============================================

module.exports = {
  crearPadre,
  listarPadres,
  obtenerPadre,
  actualizarPadre,
  asociarPaciente,
  desasociarPaciente,
  marcarContactoPrincipal,
  desactivarPadre,
  activarPadre,
};
