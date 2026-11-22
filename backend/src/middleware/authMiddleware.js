const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const ALIASES_ROL = {
  admin: "admin",
  administrador: "admin",
  medico: "personal_salud",
  enfermero: "personal_salud",
  "personal medico": "personal_salud",
  "personal médico": "personal_salud",
  personal_salud: "personal_salud",
  recepcion: "encargado_centro",
  recepcionista: "encargado_centro",
  encargado: "encargado_centro",
  encargado_centro: "encargado_centro",
};

function normalizarRol(rol) {
  const clave = String(rol || "").trim().toLowerCase();
  return ALIASES_ROL[clave] || null;
}

function etiquetaRol(rol) {
  const normalizado = normalizarRol(rol);
  const etiquetas = {
    admin: "Administrador del sistema",
    personal_salud: "Personal de salud",
    encargado_centro: "Encargado del centro de salud",
  };
  return etiquetas[normalizado] || "Rol no reconocido";
}

// El rol siempre se vuelve a leer de PostgreSQL. Así, un cambio o una
// desactivación de usuario tiene efecto sin esperar a que venza el JWT.
const verificarToken = async (req, res, next) => {
  // Evita consultar dos veces si el control global ya autenticó esta petición.
  if (req.usuario?.id_usuario) return next();

  try {
    const encabezado = req.headers.authorization;

    if (!encabezado || !encabezado.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        mensaje: "Token de acceso requerido",
      });
    }

    const token = encabezado.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const idUsuario = Number(decoded.id || decoded.id_usuario);

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(401).json({
        success: false,
        mensaje: "Token de acceso inválido",
      });
    }

    const resultado = await pool.query(
      `SELECT id_usuario, nombre, correo, rol, estado
       FROM usuarios
       WHERE id_usuario = $1 AND estado = TRUE
       LIMIT 1`,
      [idUsuario]
    );

    if (!resultado.rowCount) {
      return res.status(401).json({
        success: false,
        mensaje: "La cuenta está desactivada o ya no existe",
      });
    }

    const usuario = resultado.rows[0];
    const rol = normalizarRol(usuario.rol);

    if (!rol) {
      return res.status(403).json({
        success: false,
        mensaje: "El usuario no tiene un rol válido asignado",
      });
    }

    req.usuario = {
      id: usuario.id_usuario,
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol,
      rol_original: usuario.rol,
    };

    return next();
  } catch (error) {
    if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError") {
      console.error("Error verificando sesión:", error.message);
    }

    return res.status(401).json({
      success: false,
      mensaje: "Token inválido o expirado",
    });
  }
};

const verificarRol = (...rolesPermitidos) => {
  const permitidos = rolesPermitidos.map(normalizarRol).filter(Boolean);

  return (req, res, next) => {
    const rolUsuario = normalizarRol(req.usuario?.rol);

    if (!rolUsuario || !permitidos.includes(rolUsuario)) {
      return res.status(403).json({
        success: false,
        mensaje: "No tienes permisos para realizar esta acción",
      });
    }

    return next();
  };
};

module.exports = {
  verificarToken,
  verificarRol,
  normalizarRol,
  etiquetaRol,
};
