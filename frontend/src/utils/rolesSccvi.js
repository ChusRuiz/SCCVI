export const ROLES_SCCVI = {
  ADMIN: "admin",
  PERSONAL_SALUD: "personal_salud",
  ENCARGADO_CENTRO: "encargado_centro",
};

export const ETIQUETAS_ROL = {
  admin: "Administrador del sistema",
  personal_salud: "Personal de salud",
  encargado_centro: "Encargado del centro de salud",
};

const PAGINAS_POR_ROL = {
  admin: [
    "dashboard", "pacientes", "comunidades", "padres", "crecimiento",
    "vacunacion", "alertas", "notificaciones", "campanas", "reportes", "usuarios",
  ],
  personal_salud: [
    "dashboard", "pacientes", "comunidades", "padres", "crecimiento",
    "vacunacion", "alertas", "notificaciones", "reportes",
  ],
  encargado_centro: [
    "dashboard", "pacientes", "comunidades", "padres", "crecimiento",
    "vacunacion", "alertas", "notificaciones", "campanas", "reportes",
  ],
};

const ACCIONES_POR_ROL = {
  gestionar_usuarios: ["admin"],
  modificar_pacientes: ["admin", "personal_salud"],
  modificar_padres: ["admin", "personal_salud"],
  modificar_comunidades: ["admin", "personal_salud"],
  registrar_crecimiento: ["admin", "personal_salud"],
  eliminar_control_crecimiento: ["admin"],
  registrar_vacunacion: ["admin", "personal_salud"],
  gestionar_catalogo_vacunas: ["admin"],
  gestionar_alertas: ["admin", "personal_salud", "encargado_centro"],
  gestionar_campanas: ["admin", "encargado_centro"],
  generar_carnet: ["admin", "personal_salud"],
  enviar_carnet: ["admin", "personal_salud"],
  consultar_reportes: ["admin", "personal_salud", "encargado_centro"],
};

const ALIAS = {
  administrador: "admin",
  medico: "personal_salud",
  enfermero: "personal_salud",
  recepcion: "encargado_centro",
  recepcionista: "encargado_centro",
};

export function normalizarRolUI(rol) {
  const valor = String(rol || "").trim().toLowerCase();
  return ALIAS[valor] || valor;
}

export function obtenerEtiquetaRol(rol) {
  return ETIQUETAS_ROL[normalizarRolUI(rol)] || "Usuario";
}

export function obtenerPaginasPermitidas(rol) {
  return PAGINAS_POR_ROL[normalizarRolUI(rol)] || [];
}

export function puedeVerPagina(rol, pagina) {
  return obtenerPaginasPermitidas(rol).includes(pagina);
}

export function puedeEjecutarAccion(rol, accion) {
  return (ACCIONES_POR_ROL[accion] || []).includes(normalizarRolUI(rol));
}
