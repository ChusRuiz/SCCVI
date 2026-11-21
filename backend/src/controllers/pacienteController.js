
const pool = require("../config/db");

// ============================================
// ERRORES CONTROLADOS
// ============================================

class ErrorValidacion extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

// ============================================
// VALIDAR IDENTIFICADORES
// ============================================

function validarId(id) {
  const numero = Number(id);

  return Number.isInteger(numero) && numero > 0;
}

// ============================================
// VALIDAR DATOS DEL PACIENTE
// ============================================

function validarDatosPaciente(body) {
  const nombres = String(body.nombres || "").trim();
  const apellidos = String(body.apellidos || "").trim();

  const fechaNacimiento = String(
    body.fecha_nacimiento || ""
  ).substring(0, 10);

  const sexo = body.sexo;
  const cui = String(body.cui || "").trim();

  const direccion =
    String(body.direccion || "").trim() || null;

  let idComunidad = null;

  if (
    body.id_comunidad !== undefined &&
    body.id_comunidad !== null &&
    body.id_comunidad !== ""
  ) {
    if (!validarId(body.id_comunidad)) {
      throw new ErrorValidacion(
        "La comunidad seleccionada no es válida"
      );
    }

    idComunidad = Number(body.id_comunidad);
  }

  if (!nombres || !apellidos || !fechaNacimiento || !sexo) {
    throw new ErrorValidacion(
      "Completa los nombres, apellidos, fecha de nacimiento y sexo"
    );
  }

  if (nombres.length > 150 || apellidos.length > 150) {
    throw new ErrorValidacion(
      "Los nombres y apellidos no pueden superar los 150 caracteres"
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
    throw new ErrorValidacion(
      "La fecha de nacimiento no tiene un formato válido"
    );
  }

  const [anio, mes, dia] = fechaNacimiento.split("-").map(Number);

  const fechaVerificada = new Date(
    Date.UTC(anio, mes - 1, dia)
  );

  if (
    fechaVerificada.getUTCFullYear() !== anio ||
    fechaVerificada.getUTCMonth() !== mes - 1 ||
    fechaVerificada.getUTCDate() !== dia
  ) {
    throw new ErrorValidacion(
      "La fecha de nacimiento no es válida"
    );
  }

  const hoy = new Date();

  const hoyTexto = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");

  if (fechaNacimiento > hoyTexto) {
    throw new ErrorValidacion(
      "La fecha de nacimiento no puede ser futura"
    );
  }

  if (!["masculino", "femenino"].includes(sexo)) {
    throw new ErrorValidacion("Sexo no válido");
  }

  if (cui && !/^\d{13}$/.test(cui)) {
    throw new ErrorValidacion(
      "El CUI debe contener exactamente 13 dígitos"
    );
  }

  return {
    nombres,
    apellidos,
    fecha_nacimiento: fechaNacimiento,
    sexo,
    cui: cui || null,
    direccion,
    id_comunidad: idComunidad,
  };
}

// ============================================
// NORMALIZAR PADRES ASOCIADOS
// ============================================

function normalizarPadres(padres) {
  if (!Array.isArray(padres)) {
    throw new ErrorValidacion(
      "Los padres asociados deben enviarse como un arreglo"
    );
  }

  const asociaciones = padres.map((padre) => {
    if (
      !padre ||
      typeof padre !== "object" ||
      Array.isArray(padre)
    ) {
      throw new ErrorValidacion(
        "Una asociación de padre tiene un formato incorrecto"
      );
    }

    const idPadre = Number(padre.id_padre);

    const parentesco = String(
      padre.parentesco || "Encargado"
    ).trim();

    const contactoPrincipal =
      padre.es_contacto_principal === true;

    if (!validarId(idPadre)) {
      throw new ErrorValidacion(
        "Uno de los identificadores de padre no es válido"
      );
    }

    if (!parentesco || parentesco.length > 40) {
      throw new ErrorValidacion(
        "El parentesco debe tener entre 1 y 40 caracteres"
      );
    }

    if (
      padre.es_contacto_principal !== undefined &&
      typeof padre.es_contacto_principal !== "boolean"
    ) {
      throw new ErrorValidacion(
        "El contacto principal debe ser verdadero o falso"
      );
    }

    return {
      id_padre: idPadre,
      parentesco,
      es_contacto_principal: contactoPrincipal,
    };
  });

  const ids = asociaciones.map(
    (padre) => padre.id_padre
  );

  if (new Set(ids).size !== ids.length) {
    throw new ErrorValidacion(
      "No puedes asociar dos veces al mismo padre"
    );
  }

  const principales = asociaciones.filter(
    (padre) => padre.es_contacto_principal
  );

  if (principales.length > 1) {
    throw new ErrorValidacion(
      "Un paciente solamente puede tener un contacto principal"
    );
  }

  return asociaciones;
}

// ============================================
// VALIDAR COMUNIDAD ACTIVA
// ============================================

async function validarComunidad(client, idComunidad) {
  if (idComunidad === null) return;

  const resultado = await client.query(
    `SELECT id_comunidad
     FROM comunidades
     WHERE id_comunidad = $1
       AND estado = 'activa'`,
    [idComunidad]
  );

  if (!resultado.rows.length) {
    throw new ErrorValidacion(
      "La comunidad seleccionada no existe o está inactiva"
    );
  }
}

// ============================================
// VALIDAR PADRES ACTIVOS
// ============================================

async function obtenerPadresValidos(client, asociaciones) {
  if (!asociaciones.length) return [];

  const ids = asociaciones.map(
    (padre) => padre.id_padre
  );

  const resultado = await client.query(
    `SELECT
        id_padre,
        nombres,
        apellidos,
        telefono
     FROM padres_familia
     WHERE id_padre = ANY($1::INTEGER[])
       AND estado = 'activo'`,
    [ids]
  );

  if (resultado.rows.length !== asociaciones.length) {
    throw new ErrorValidacion(
      "Uno o varios padres no existen o se encuentran inactivos"
    );
  }

  return resultado.rows;
}

// ============================================
// OBTENER DATOS DEL CONTACTO PRINCIPAL
// ============================================

function obtenerDatosEncargado(asociaciones, padresValidos) {
  if (!asociaciones.length) {
    return {
      nombre_encargado: null,
      telefono_encargado: null,
    };
  }

  const principal =
    asociaciones.find(
      (padre) => padre.es_contacto_principal
    ) || asociaciones[0];

  const datosPadre = padresValidos.find(
    (padre) => padre.id_padre === principal.id_padre
  );

  return {
    nombre_encargado:
      `${datosPadre.nombres} ${datosPadre.apellidos}`.trim(),

    telefono_encargado: datosPadre.telefono,
  };
}

// ============================================
// GUARDAR RELACIONES PADRES - PACIENTE
// ============================================

async function guardarPadresPaciente(
  client,
  idPaciente,
  asociaciones,
  reemplazar = false
) {
  const padres = normalizarPadres(asociaciones);

  const padresValidos = await obtenerPadresValidos(
    client,
    padres
  );

  if (reemplazar) {
    await client.query(
      `DELETE FROM padres_pacientes
       WHERE id_paciente = $1`,
      [idPaciente]
    );
  }

  for (const padre of padres) {
    if (padre.es_contacto_principal) {
      await client.query(
        `UPDATE padres_pacientes
         SET es_contacto_principal = FALSE
         WHERE id_paciente = $1
           AND es_contacto_principal = TRUE`,
        [idPaciente]
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
        padre.id_padre,
        idPaciente,
        padre.parentesco,
        padre.es_contacto_principal,
      ]
    );
  }

  return {
    asociaciones: padres,
    encargado: obtenerDatosEncargado(
      padres,
      padresValidos
    ),
  };
}

// ============================================
// LISTAR Y BUSCAR PACIENTES
// ============================================

const listarPacientes = async (req, res) => {
  try {
    const {
      buscar = "",
      estado = "activo",
    } = req.query;

    if (!["activo", "inactivo", "todas"].includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado de paciente no válido",
      });
    }

    const resultado = await pool.query(
      `SELECT
          p.*,
          c.nombre AS comunidad_nombre,

          COALESCE(
            relaciones.padres,
            '[]'::json
          ) AS padres

       FROM pacientes p

       LEFT JOIN comunidades c
          ON p.id_comunidad = c.id_comunidad

       LEFT JOIN LATERAL (
          SELECT
            json_agg(
              json_build_object(
                'id_padre', pf.id_padre,
                'nombres', pf.nombres,
                'apellidos', pf.apellidos,
                'telefono', pf.telefono,
                'correo', pf.correo,
                'parentesco', pp.parentesco,
                'es_contacto_principal',
                  pp.es_contacto_principal
              )
              ORDER BY pp.es_contacto_principal DESC
            ) AS padres

          FROM padres_pacientes pp

          INNER JOIN padres_familia pf
            ON pp.id_padre = pf.id_padre

          WHERE pp.id_paciente = p.id_paciente
       ) relaciones ON TRUE

       WHERE
          ($1 = 'todas' OR p.estado = $1)

          AND (
            p.nombres ILIKE $2
            OR p.apellidos ILIKE $2
            OR COALESCE(p.cui, '') ILIKE $2
          )

       ORDER BY p.apellidos, p.nombres`,
      [
        estado,
        `%${String(buscar).trim()}%`,
      ]
    );

    return res.json(resultado.rows);

  } catch (error) {
    console.error("Error al consultar pacientes:", error);

    return res.status(500).json({
      mensaje: "Error al consultar pacientes",
    });
  }
};

// ============================================
// CONSULTAR PACIENTE INDIVIDUAL
// ============================================

const obtenerPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de paciente no válido",
      });
    }

    const resultado = await pool.query(
      `SELECT
          p.*,
          c.nombre AS comunidad_nombre,

          COALESCE(
            relaciones.padres,
            '[]'::json
          ) AS padres

       FROM pacientes p

       LEFT JOIN comunidades c
          ON p.id_comunidad = c.id_comunidad

       LEFT JOIN LATERAL (
          SELECT
            json_agg(
              json_build_object(
                'id_padre', pf.id_padre,
                'nombres', pf.nombres,
                'apellidos', pf.apellidos,
                'dpi', pf.dpi,
                'telefono', pf.telefono,
                'correo', pf.correo,
                'canal_preferido', pf.canal_preferido,
                'comunidad_nombre', cp.nombre,
                'parentesco', pp.parentesco,
                'es_contacto_principal',
                  pp.es_contacto_principal
              )
              ORDER BY
                pp.es_contacto_principal DESC,
                pf.apellidos,
                pf.nombres
            ) AS padres

          FROM padres_pacientes pp

          INNER JOIN padres_familia pf
            ON pp.id_padre = pf.id_padre

          LEFT JOIN comunidades cp
            ON pf.id_comunidad = cp.id_comunidad

          WHERE pp.id_paciente = p.id_paciente
       ) relaciones ON TRUE

       WHERE p.id_paciente = $1`,
      [id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    return res.json(resultado.rows[0]);

  } catch (error) {
    console.error("Error al consultar paciente:", error);

    return res.status(500).json({
      mensaje: "Error al consultar paciente",
    });
  }
};

// ============================================
// REGISTRAR PACIENTE
// ============================================

const crearPaciente = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const datos = validarDatosPaciente(req.body);

    const incluyePadres =
      Object.prototype.hasOwnProperty.call(req.body, "padres");

    const asociaciones = incluyePadres
      ? normalizarPadres(req.body.padres)
      : [];

    const nombreLegado = String(
      req.body.nombre_encargado || ""
    ).trim();

    const telefonoLegado = String(
      req.body.telefono_encargado || ""
    ).trim() || null;

    if (!incluyePadres && !nombreLegado) {
      throw new ErrorValidacion(
        "Debes asociar al menos un padre o ingresar el nombre del encargado"
      );
    }

    if (
      incluyePadres &&
      asociaciones.length === 0 &&
      !nombreLegado
    ) {
      throw new ErrorValidacion(
        "Debes asociar al menos un padre o ingresar el nombre del encargado"
      );
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    await validarComunidad(client, datos.id_comunidad);

    const padresValidos = await obtenerPadresValidos(
      client,
      asociaciones
    );

    const datosEncargado = asociaciones.length
      ? obtenerDatosEncargado(asociaciones, padresValidos)
      : {
          nombre_encargado: nombreLegado,
          telefono_encargado: telefonoLegado,
        };

    const resultado = await client.query(
      `INSERT INTO pacientes (
          nombres,
          apellidos,
          fecha_nacimiento,
          sexo,
          cui,
          nombre_encargado,
          telefono_encargado,
          direccion,
          id_comunidad
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        datos.nombres,
        datos.apellidos,
        datos.fecha_nacimiento,
        datos.sexo,
        datos.cui,
        datosEncargado.nombre_encargado,
        datosEncargado.telefono_encargado,
        datos.direccion,
        datos.id_comunidad,
      ]
    );

    const paciente = resultado.rows[0];

    if (incluyePadres && asociaciones.length > 0) {
      await guardarPadresPaciente(
        client,
        paciente.id_paciente,
        asociaciones,
        false
      );
    }

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.status(201).json({
      mensaje: "Paciente registrado correctamente",
      paciente,
      padres_asociados: asociaciones,
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error al revertir registro:", rollbackError);
      }
    }

    if (error instanceof ErrorValidacion) {
      return res.status(error.status).json({
        mensaje: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "El CUI ya se encuentra registrado",
      });
    }

    console.error("Error al registrar paciente:", error);

    return res.status(500).json({
      mensaje: "Error al registrar paciente",
      detalle: error.message,
    });

  } finally {
    if (client) client.release();
  }
};

// ============================================
// ACTUALIZAR PACIENTE
// ============================================

const actualizarPaciente = async (req, res) => {
  let client;
  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de paciente no válido",
      });
    }

    const datos = validarDatosPaciente(req.body);

    const incluyePadres =
      Object.prototype.hasOwnProperty.call(req.body, "padres");

    const asociaciones = incluyePadres
      ? normalizarPadres(req.body.padres)
      : null;

    client = await pool.connect();

    await client.query("BEGIN");
    transaccionIniciada = true;

    // ========================================
    // CONSULTAR PACIENTE EXISTENTE
    // ========================================

    const actualResult = await client.query(
      `SELECT *
       FROM pacientes
       WHERE id_paciente = $1
       FOR UPDATE`,
      [id]
    );

    if (!actualResult.rows.length) {
      await client.query("ROLLBACK");
      transaccionIniciada = false;

      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    const actual = actualResult.rows[0];

    // ========================================
    // CORRECCION: CONSERVAR COMUNIDAD EXISTENTE
    // ========================================

    // Si el formulario envía id_comunidad, se utiliza
    // la comunidad seleccionada.
    //
    // Si no lo envía, se conserva la comunidad
    // que el paciente ya tenía registrada.

    const idComunidadFinal =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "id_comunidad"
      )
        ? datos.id_comunidad
        : actual.id_comunidad;

    await validarComunidad(client, idComunidadFinal);

    // ========================================
    // OBTENER DATOS DEL ENCARGADO
    // ========================================

    let datosEncargado;

    if (incluyePadres && asociaciones.length > 0) {
      const padresValidos = await obtenerPadresValidos(
        client,
        asociaciones
      );

      datosEncargado = obtenerDatosEncargado(
        asociaciones,
        padresValidos
      );

    } else if (incluyePadres) {
      datosEncargado = {
        nombre_encargado:
          String(req.body.nombre_encargado || "").trim() ||
          actual.nombre_encargado,

        telefono_encargado:
          String(req.body.telefono_encargado || "").trim() ||
          actual.telefono_encargado,
      };

    } else {
      datosEncargado = {
        nombre_encargado:
          String(req.body.nombre_encargado || "").trim() ||
          actual.nombre_encargado,

        telefono_encargado:
          String(req.body.telefono_encargado || "").trim() ||
          actual.telefono_encargado,
      };
    }

    // ========================================
    // ACTUALIZAR DATOS DEL PACIENTE
    // ========================================

    const resultado = await client.query(
      `UPDATE pacientes
       SET
          nombres = $1,
          apellidos = $2,
          fecha_nacimiento = $3,
          sexo = $4,
          cui = $5,
          nombre_encargado = $6,
          telefono_encargado = $7,
          direccion = $8,
          id_comunidad = $9

       WHERE id_paciente = $10
       RETURNING *`,
      [
        datos.nombres,
        datos.apellidos,
        datos.fecha_nacimiento,
        datos.sexo,
        datos.cui,
        datosEncargado.nombre_encargado,
        datosEncargado.telefono_encargado,
        datos.direccion,
        idComunidadFinal,
        id,
      ]
    );

    // ========================================
    // ACTUALIZAR RELACIONES CON PADRES
    // ========================================

    // Si se envía el arreglo padres, se reemplazan
    // las asociaciones existentes.
    //
    // Si no se envía, se conservan las relaciones actuales.

    if (incluyePadres) {
      await guardarPadresPaciente(
        client,
        Number(id),
        asociaciones,
        true
      );
    }

    await client.query("COMMIT");
    transaccionIniciada = false;

    return res.json({
      mensaje: "Paciente actualizado correctamente",
      paciente: resultado.rows[0],
      padres_asociados: incluyePadres
        ? asociaciones
        : undefined,
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error al revertir actualización:", rollbackError);
      }
    }

    if (error instanceof ErrorValidacion) {
      return res.status(error.status).json({
        mensaje: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "El CUI ya se encuentra registrado",
      });
    }

    console.error("Error al actualizar paciente:", error);

    return res.status(500).json({
      mensaje: "Error al actualizar paciente",
      detalle: error.message,
    });

  } finally {
    if (client) client.release();
  }
};

// ============================================
// DESACTIVAR PACIENTE
// ============================================

const desactivarPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        mensaje: "Identificador de paciente no válido",
      });
    }

    const resultado = await pool.query(
      `UPDATE pacientes
       SET estado = 'inactivo'
       WHERE id_paciente = $1
       RETURNING *`,
      [id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    return res.json({
      mensaje: "Paciente desactivado correctamente",
      paciente: resultado.rows[0],
    });

  } catch (error) {
    console.error("Error al desactivar paciente:", error);

    return res.status(500).json({
      mensaje: "Error al desactivar paciente",
    });
  }
};

// ============================================
// EXPORTAR CONTROLADOR
// ============================================

module.exports = {
  crearPaciente,
  listarPacientes,
  obtenerPaciente,
  actualizarPaciente,
  desactivarPaciente,
};
