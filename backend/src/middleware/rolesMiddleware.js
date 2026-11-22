const { verificarToken, normalizarRol } = require("./authMiddleware");

const ROLES = {
  ADMIN: "admin",
  PERSONAL_SALUD: "personal_salud",
  ENCARGADO_CENTRO: "encargado_centro",
};

const TODOS = [ROLES.ADMIN, ROLES.PERSONAL_SALUD, ROLES.ENCARGADO_CENTRO];
const CLINICO = [ROLES.ADMIN, ROLES.PERSONAL_SALUD];
const SUPERVISION = [ROLES.ADMIN, ROLES.ENCARGADO_CENTRO];
const OPERACION_ALERTAS = TODOS;

function esRutaPublica(method, path) {
  if (method === "POST" && path === "/auth/login") return true;
  if (method === "GET" && path === "/health") return true;
  // La consulta pública del carnet se autentica con token QR + PIN.
  if (method === "POST" && path === "/carnets/acceso") return true;
  return false;
}

function obtenerPolitica(method, path) {
  const p = path.replace(/\/+$/, "") || "/";
  const m = method.toUpperCase();

  if (p === "/auth/me") return TODOS;
  if (p === "/usuarios" || p.startsWith("/usuarios/")) return [ROLES.ADMIN];

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return m === "GET" ? TODOS : [ROLES.ADMIN];
  }

  if (p === "/pacientes" || p.startsWith("/pacientes/")) {
    return m === "GET" ? TODOS : CLINICO;
  }

  if (p === "/padres" || p.startsWith("/padres/")) {
    return m === "GET" ? TODOS : CLINICO;
  }

  if (p === "/comunidades" || p.startsWith("/comunidades/")) {
    return m === "GET" ? TODOS : CLINICO;
  }

  if (p === "/crecimiento" || p.startsWith("/crecimiento/")) {
    if (m === "GET") return TODOS;
    if (m === "POST") return CLINICO;
    // La eliminación de un registro clínico queda reservada al administrador.
    if (m === "DELETE") return [ROLES.ADMIN];
    return [ROLES.ADMIN];
  }

  if (p === "/vacunacion" || p.startsWith("/vacunacion/")) {
    if (m === "GET") return TODOS;
    if (p.startsWith("/vacunacion/vacunas")) return [ROLES.ADMIN];
    if (m === "POST") return CLINICO;
    if (m === "PATCH" || m === "PUT" || m === "DELETE") return [ROLES.ADMIN];
    return [ROLES.ADMIN];
  }

  if (p === "/alertas" || p.startsWith("/alertas/")) {
    if (m === "GET") return TODOS;
    if (m === "POST") return [ROLES.ADMIN]; // generación manual
    if (m === "PATCH") return OPERACION_ALERTAS;
    return [ROLES.ADMIN];
  }

  if (p === "/notificaciones" || p.startsWith("/notificaciones/")) {
    return m === "GET" ? TODOS : [ROLES.ADMIN];
  }

  if (p === "/campanas" || p.startsWith("/campanas/")) {
    if (m === "GET") return TODOS;
    if (m === "POST") return SUPERVISION;
    if (m === "PATCH" || m === "PUT" || m === "DELETE") return SUPERVISION;
    return [ROLES.ADMIN];
  }

  if (p === "/reportes" || p.startsWith("/reportes/")) {
    return m === "GET" ? TODOS : [ROLES.ADMIN];
  }

  if (p === "/carnets" || p.startsWith("/carnets/")) {
    if (m === "GET") return TODOS;
    if (m === "POST" && /\/paciente\/\d+\/generar$/.test(p)) return CLINICO;
    if (m === "POST" && /\/\d+\/pdf$/.test(p)) return TODOS;
    if (m === "POST" && /\/\d+\/enviar-correo$/.test(p)) return CLINICO;
    if (m === "PATCH" && /\/\d+\/revocar$/.test(p)) return CLINICO;
    return [ROLES.ADMIN];
  }

  // Política por defecto: lectura para usuarios autenticados; las escrituras
  // nuevas/desconocidas quedan reservadas al administrador hasta definirlas.
  return m === "GET" ? TODOS : [ROLES.ADMIN];
}

async function protegerApi(req, res, next) {
  const path = req.originalUrl.split("?")[0].replace(/^\/api/, "") || "/";

  if (esRutaPublica(req.method, path)) return next();

  return verificarToken(req, res, () => {
    const rolesPermitidos = obtenerPolitica(req.method, path);

    const rol = normalizarRol(req.usuario?.rol);
    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({
        success: false,
        mensaje: "Tu rol no tiene permisos para realizar esta operación",
        rol: req.usuario?.rol,
      });
    }

    return next();
  });
}

module.exports = { ROLES, protegerApi, obtenerPolitica };
