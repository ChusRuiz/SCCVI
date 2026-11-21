
const express = require("express");
const router = express.Router();

// ============================================
// CONTROLADOR DE CRECIMIENTO
// ============================================

const {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  eliminarControl,
} = require("../controllers/crecimientoController");

// ============================================
// CONTROLADOR DE CURVAS OMS
// ============================================

const {
  obtenerCurvasOMS,
} = require("../controllers/curvasOmsController");

// ============================================
// AUTENTICACION
// ============================================

const {
  verificarToken,
} = require("../middleware/authMiddleware");

router.use(verificarToken);

// ============================================
// REGISTRAR CONTROL
// POST /api/crecimiento
// ============================================

router.post("/", registrarControl);

// ============================================
// OBTENER CURVAS OMS
// GET /api/crecimiento/paciente/:id/curvas-oms
// ============================================

router.get(
  "/paciente/:id/curvas-oms",
  obtenerCurvasOMS
);

// ============================================
// HISTORIAL POR PACIENTE
// GET /api/crecimiento/paciente/:id
// ============================================

router.get(
  "/paciente/:id",
  obtenerHistorial
);

// ============================================
// CONSULTAR CONTROL INDIVIDUAL
// GET /api/crecimiento/:id
// ============================================

router.get(
  "/:id",
  obtenerControl
);

// ============================================
// ELIMINAR CONTROL
// DELETE /api/crecimiento/:id
// ============================================

router.delete(
  "/:id",
  eliminarControl
);

module.exports = router;
