const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  try {
    const encabezado = req.headers.authorization;

    if (!encabezado || !encabezado.startsWith("Bearer ")) {
      return res.status(401).json({
        mensaje: "Token de acceso requerido",
      });
    }

    const token = encabezado.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: "Token inválido o expirado",
    });
  }
};

const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: "No tienes permisos para acceder",
      });
    }

    next();
  };
};

module.exports = { verificarToken, verificarRol };