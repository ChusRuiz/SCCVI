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
  obtenerEstadoTelegram,
  crearEnlaceTelegram,
  desvincularTelegram,
} = require("../controllers/telegramVinculacionController");

const {
  verificarToken,
  verificarRol,
} = require("../middleware/authMiddleware");

// Todas las rutas requieren autenticación JWT.
router.use(verificarToken);

// Vincular / desvincular cuentas solo puede hacerlo personal autorizado.
const puedeAdministrarVinculos = verificarRol(
  "admin",
  "medico",
  "enfermero",
  "recepcion"
);

// ============================================
// CRUD DE PADRES
// ============================================
router.post("/", crearPadre);
router.get("/", listarPadres);

// ============================================
// VINCULACIÓN TELEGRAM
// ============================================
router.get("/:id/telegram/estado", obtenerEstadoTelegram);
router.post("/:id/telegram/vincular", puedeAdministrarVinculos, crearEnlaceTelegram);
router.delete("/:id/telegram/vincular", puedeAdministrarVinculos, desvincularTelegram);

// Consultar padre individual y sus niños.
router.get("/:id", obtenerPadre);
router.put("/:id", actualizarPadre);
router.patch("/:id/desactivar", desactivarPadre);
router.patch("/:id/activar", activarPadre);

// ============================================
// RELACIONES PADRES - PACIENTES
// ============================================
router.post("/:id/pacientes", asociarPaciente);
router.delete("/:id/pacientes/:idPaciente", desasociarPaciente);
router.patch(
  "/:id/pacientes/:idPaciente/contacto-principal",
  marcarContactoPrincipal
);

module.exports = router;