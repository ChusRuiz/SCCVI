
const express = require("express");
const router = express.Router();

const {
  crearPadre,
  listarPadres,
  obtenerPadre,
  actualizarPadre,
  asociarPaciente,
  desasociarPaciente,
  marcarContactoPrincipal,
  desactivarPadre,
  activarPadre,
} = require("../controllers/padreController");

const {
  verificarToken,
} = require("../middleware/authMiddleware");

// Todas las rutas requieren autenticación JWT
router.use(verificarToken);

// ============================================
// CRUD DE PADRES
// ============================================

// Registrar padre
router.post("/", crearPadre);

// Listar y buscar padres
router.get("/", listarPadres);

// Consultar padre individual y sus niños
router.get("/:id", obtenerPadre);

// Actualizar información del padre
router.put("/:id", actualizarPadre);

// Desactivar padre
router.patch("/:id/desactivar", desactivarPadre);

// Reactivar padre
router.patch("/:id/activar", activarPadre);

// ============================================
// RELACIONES PADRES - PACIENTES
// ============================================

// Asociar un niño a un padre
router.post("/:id/pacientes", asociarPaciente);

// Quitar la asociación de un niño
router.delete("/:id/pacientes/:idPaciente", desasociarPaciente);

// Designar al padre como contacto principal de un niño
router.patch(
  "/:id/pacientes/:idPaciente/contacto-principal",
  marcarContactoPrincipal
);

module.exports = router;
