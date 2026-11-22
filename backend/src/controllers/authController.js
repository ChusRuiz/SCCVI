const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { normalizarRol, etiquetaRol } = require("../middleware/authMiddleware");

const login = async (req, res) => {
  try {
    const correo = String(req.body?.correo || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!correo || !password) {
      return res.status(400).json({ success: false, mensaje: "Correo y contraseña son obligatorios" });
    }

    const resultado = await pool.query(
      `SELECT id_usuario, nombre, correo, password, rol, estado
       FROM usuarios
       WHERE LOWER(correo) = $1 AND estado = TRUE
       LIMIT 1`,
      [correo]
    );

    if (!resultado.rowCount) {
      return res.status(401).json({ success: false, mensaje: "Credenciales incorrectas" });
    }

    const usuario = resultado.rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ success: false, mensaje: "Credenciales incorrectas" });
    }

    const rol = normalizarRol(usuario.rol);
    if (!rol) {
      return res.status(403).json({ success: false, mensaje: "La cuenta no tiene un rol válido. Contacta al administrador." });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    return res.json({
      success: true,
      mensaje: "Inicio de sesión exitoso",
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol,
        rol_label: etiquetaRol(rol),
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ success: false, mensaje: "Error interno del servidor" });
  }
};

const obtenerPerfil = async (req, res) => {
  return res.json({ success: true, usuario: req.usuario });
};

module.exports = { login, obtenerPerfil };