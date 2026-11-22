import { puedeEjecutarAccion } from "./rolesSccvi";

// Uso: <Puede rol={usuario.rol} accion="registrar_vacunacion">...</Puede>
// Esto es solo control visual. El backend también valida cada operación.
export default function Puede({ rol, accion, children, fallback = null }) {
  return puedeEjecutarAccion(rol, accion) ? children : fallback;
}
