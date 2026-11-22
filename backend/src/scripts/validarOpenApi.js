const spec = require("../docs/openapi.json");

const metodos = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const errores = [];
const ids = new Set();
let operaciones = 0;

if (spec.openapi !== "3.0.3") errores.push("La especificación no usa OpenAPI 3.0.3.");
if (!spec.info?.title || !spec.info?.version) errores.push("Falta el título o la versión.");
if (!spec.components?.securitySchemes?.bearerAuth) errores.push("Falta el esquema de autenticación JWT.");

function revisarSchemaOas30(valor, ruta = "components.schemas") {
  if (!valor || typeof valor !== "object") return;
  if (Object.prototype.hasOwnProperty.call(valor, "exclusiveMinimum") && typeof valor.exclusiveMinimum !== "boolean") {
    errores.push(`${ruta}: exclusiveMinimum debe ser booleano en OpenAPI 3.0.x.`);
  }
  for (const [clave, hijo] of Object.entries(valor)) revisarSchemaOas30(hijo, `${ruta}.${clave}`);
}
revisarSchemaOas30(spec.components?.schemas || {});

for (const [ruta, item] of Object.entries(spec.paths || {})) {
  for (const [metodo, operacion] of Object.entries(item)) {
    if (!metodos.has(metodo)) continue;
    operaciones += 1;
    if (!operacion.operationId) errores.push(`${metodo.toUpperCase()} ${ruta}: falta operationId.`);
    if (operacion.operationId && ids.has(operacion.operationId)) errores.push(`operationId duplicado: ${operacion.operationId}.`);
    if (operacion.operationId) ids.add(operacion.operationId);
    if (!operacion.summary) errores.push(`${metodo.toUpperCase()} ${ruta}: falta summary.`);
    if (!operacion.tags?.length) errores.push(`${metodo.toUpperCase()} ${ruta}: falta tag.`);
    if (!operacion.responses || !Object.keys(operacion.responses).length) errores.push(`${metodo.toUpperCase()} ${ruta}: faltan responses.`);
    if (ruta.startsWith("/api/") && !operacion.security && !["/api/auth/login", "/api/carnets/acceso", "/api/health"].includes(ruta)) {
      errores.push(`${metodo.toUpperCase()} ${ruta}: no declara security JWT.`);
    }
  }
}

const rutasEsperadas = [
  ["get", "/"],
  ["get", "/health/live"],
  ["get", "/health/ready"],
  ["get", "/api/health"],
  ["get", "/api/protegido"],
  ["post", "/api/auth/login"],
  ["get", "/api/auth/me"],
  ["get", "/api/usuarios"],
  ["post", "/api/usuarios"],
  ["put", "/api/usuarios/{id}"],
  ["patch", "/api/usuarios/{id}/estado"],
  ["get", "/api/pacientes"],
  ["post", "/api/pacientes"],
  ["get", "/api/pacientes/{id}"],
  ["put", "/api/pacientes/{id}"],
  ["patch", "/api/pacientes/{id}/desactivar"],
  ["post", "/api/crecimiento"],
  ["get", "/api/crecimiento/paciente/{id}/curvas-oms"],
  ["get", "/api/crecimiento/paciente/{id}"],
  ["get", "/api/crecimiento/{id}"],
  ["delete", "/api/crecimiento/{id}"],
  ["get", "/api/vacunacion/vacunas"],
  ["post", "/api/vacunacion/vacunas"],
  ["patch", "/api/vacunacion/vacunas/{id}/desactivar"],
  ["patch", "/api/vacunacion/vacunas/{id}/activar"],
  ["post", "/api/vacunacion"],
  ["get", "/api/vacunacion/paciente/{id}"],
  ["get", "/api/vacunacion/proximas-dosis"],
  ["get", "/api/dashboard"],
  ["get", "/api/comunidades"],
  ["post", "/api/comunidades"],
  ["get", "/api/comunidades/{id}"],
  ["put", "/api/comunidades/{id}"],
  ["patch", "/api/comunidades/{id}/desactivar"],
  ["patch", "/api/comunidades/{id}/activar"],
  ["get", "/api/padres"],
  ["post", "/api/padres"],
  ["get", "/api/padres/{id}"],
  ["put", "/api/padres/{id}"],
  ["patch", "/api/padres/{id}/desactivar"],
  ["patch", "/api/padres/{id}/activar"],
  ["post", "/api/padres/{id}/pacientes"],
  ["delete", "/api/padres/{id}/pacientes/{idPaciente}"],
  ["patch", "/api/padres/{id}/pacientes/{idPaciente}/contacto-principal"],
  ["get", "/api/padres/{id}/telegram/estado"],
  ["post", "/api/padres/{id}/telegram/vincular"],
  ["delete", "/api/padres/{id}/telegram/vincular"],
  ["get", "/api/alertas"],
  ["post", "/api/alertas/generar"],
  ["get", "/api/alertas/estadisticas"],
  ["get", "/api/alertas/{id}"],
  ["patch", "/api/alertas/{id}/revisar"],
  ["patch", "/api/alertas/{id}/resolver"],
  ["patch", "/api/alertas/{id}/descartar"],
  ["get", "/api/notificaciones"],
  ["get", "/api/notificaciones/estadisticas"],
  ["get", "/api/notificaciones/{id}"],
  ["post", "/api/carnets/acceso"],
  ["post", "/api/carnets/paciente/{id}/generar"],
  ["get", "/api/carnets/paciente/{id}"],
  ["post", "/api/carnets/{id}/pdf"],
  ["post", "/api/carnets/{id}/enviar-correo"],
  ["patch", "/api/carnets/{id}/revocar"],
  ["post", "/api/campanas/previsualizar"],
  ["post", "/api/campanas"],
  ["get", "/api/campanas"],
  ["get", "/api/campanas/{id}"],
  ["get", "/api/reportes/resumen"],
  ["get", "/api/reportes/bajo-peso"],
  ["get", "/api/reportes/sobrepeso"],
  ["get", "/api/reportes/vacunas-incompletas"],
  ["get", "/api/reportes/cobertura-comunidad"],
  ["get", "/api/reportes/crecimiento-promedio-comunidad"],
];
for (const [metodo, ruta] of rutasEsperadas) {
  if (!spec.paths?.[ruta]?.[metodo]) errores.push(`Falta documentar ${metodo.toUpperCase()} ${ruta}.`);
}

if (errores.length) {
  console.error("Validación OpenAPI: ERROR");
  for (const error of errores) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validación OpenAPI: OK. ${operaciones} operaciones documentadas, ${rutasEsperadas.length} rutas comprobadas.`);
