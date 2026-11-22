const pool = require("../config/db");
const bcrypt = require("bcrypt");

const ROLES_VALIDOS = ["admin", "personal_salud", "encargado_centro"];

function validarDatos({ nombre, correo, rol, password }, exigirPassword = false) {
  const datos = {
    nombre: String(nombre || "").trim(),
    correo: String(correo || "").trim().toLowerCase(),
    rol: String(rol || "").trim(),
    password: String(password || ""),
  };

  if (!datos.nombre || datos.nombre.length > 150) {
    return { error: "El nombre es obligatorio y no puede superar 150 caracteres." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo) || datos.correo.length > 150) {
    return { error: "Ingresa un correo electrónico válido de máximo 150 caracteres." };
  }
  if (!ROLES_VALIDOS.includes(datos.rol)) {
    return { error: "Selecciona uno de los tres roles permitidos." };
  }
  if ((exigirPassword || datos.password) && datos.password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  return { datos };
}

async function bloquearCambiosUltimoAdmin(client, idUsuario, rolNuevo, estadoNuevo) {
  // Los llamadores toman el advisory lock antes de modificar cuentas para
  // serializar cambios y proteger al último administrador activo.
  const actual = await client.query(
    `SELECT id_usuario, rol, estado
     FROM usuarios
     WHERE id_usuario = $1
     FOR UPDATE`,
    [idUsuario]
  );

  if (!actual.rowCount) return { error: "Usuario no encontrado.", status: 404 };

  const eraAdminActivo = actual.rows[0].rol === "admin" && actual.rows[0].estado === true;
  const dejaDeSerAdmin = rolNuevo !== "admin" || estadoNuevo !== true;

  if (eraAdminActivo && dejaDeSerAdmin) {
    const otros = await client.query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM usuarios
       WHERE rol = 'admin' AND estado = TRUE AND id_usuario <> $1`,
      [idUsuario]
    );

    if (otros.rows[0].total < 1) {
      return {
        error: "No puedes quitar o desactivar al último administrador activo del sistema.",
        status: 409,
      };
    }
  }

  return { actual: actual.rows[0] };
}

const listarUsuarios = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id_usuario, nombre, correo, rol, estado
       FROM usuarios
       ORDER BY nombre ASC, id_usuario ASC`
    );
    return res.json({ success: true, usuarios: resultado.rows });
  } catch (error) {
    console.error("Error listando usuarios:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudieron consultar los usuarios." });
  }
};

const crearUsuario = async (req, res) => {
  const validacion = validarDatos(req.body, true);
  if (validacion.error) {
    return res.status(400).json({ success: false, mensaje: validacion.error });
  }

  const { nombre, correo, rol, password } = validacion.datos;

  try {
    const existente = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1",
      [correo]
    );
    if (existente.rowCount) {
      return res.status(409).json({ success: false, mensaje: "Ya existe un usuario con ese correo." });
    }

    const hash = await bcrypt.hash(password, 12);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password, rol, estado)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id_usuario, nombre, correo, rol, estado`,
      [nombre, correo, hash, rol]
    );

    return res.status(201).json({ success: true, mensaje: "Usuario creado correctamente.", usuario: resultado.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, mensaje: "El correo ya está registrado." });
    }
    console.error("Error creando usuario:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo crear el usuario." });
  }
};

const actualizarUsuario = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, mensaje: "Identificador de usuario no válido." });
  }

  const validacion = validarDatos(req.body, false);
  if (validacion.error) {
    return res.status(400).json({ success: false, mensaje: validacion.error });
  }

  if (Number(req.usuario?.id_usuario) === id && validacion.datos.rol !== "admin") {
    return res.status(409).json({ success: false, mensaje: "No puedes cambiar tu propio rol de administrador." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(845201)");
    const control = await bloquearCambiosUltimoAdmin(client, id, validacion.datos.rol, true);
    if (control.error) {
      await client.query("ROLLBACK");
      return res.status(control.status).json({ success: false, mensaje: control.error });
    }

    const emailDuplicado = await client.query(
      `SELECT id_usuario FROM usuarios
       WHERE LOWER(correo) = $1 AND id_usuario <> $2 LIMIT 1`,
      [validacion.datos.correo, id]
    );
    if (emailDuplicado.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, mensaje: "Ese correo pertenece a otro usuario." });
    }

    let hash = null;
    if (validacion.datos.password) hash = await bcrypt.hash(validacion.datos.password, 12);

    const resultado = await client.query(
      `UPDATE usuarios
       SET nombre = $2,
           correo = $3,
           rol = $4,
           password = COALESCE($5, password)
       WHERE id_usuario = $1
       RETURNING id_usuario, nombre, correo, rol, estado`,
      [id, validacion.datos.nombre, validacion.datos.correo, validacion.datos.rol, hash]
    );

    await client.query("COMMIT");
    return res.json({ success: true, mensaje: "Usuario actualizado correctamente.", usuario: resultado.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ success: false, mensaje: "El correo ya está registrado." });
    }
    console.error("Error actualizando usuario:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo actualizar el usuario." });
  } finally {
    client.release();
  }
};

const cambiarEstadoUsuario = async (req, res) => {
  const id = Number(req.params.id);
  const estado = req.body?.estado;

  if (!Number.isInteger(id) || id <= 0 || typeof estado !== "boolean") {
    return res.status(400).json({ success: false, mensaje: "Identificador o estado no válido." });
  }

  if (Number(req.usuario?.id_usuario) === id && estado === false) {
    return res.status(409).json({ success: false, mensaje: "No puedes desactivar tu propia cuenta." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(845201)");
    const actualResult = await client.query(
      `SELECT id_usuario, rol, estado FROM usuarios WHERE id_usuario = $1 FOR UPDATE`,
      [id]
    );
    if (!actualResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, mensaje: "Usuario no encontrado." });
    }

    const actual = actualResult.rows[0];
    const control = await bloquearCambiosUltimoAdmin(client, id, actual.rol, estado);
    if (control.error) {
      await client.query("ROLLBACK");
      return res.status(control.status).json({ success: false, mensaje: control.error });
    }

    const resultado = await client.query(
      `UPDATE usuarios SET estado = $2
       WHERE id_usuario = $1
       RETURNING id_usuario, nombre, correo, rol, estado`,
      [id, estado]
    );

    await client.query("COMMIT");
    return res.json({ success: true, mensaje: estado ? "Usuario activado." : "Usuario desactivado.", usuario: resultado.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error cambiando estado de usuario:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo cambiar el estado del usuario." });
  } finally {
    client.release();
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
};
