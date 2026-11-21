
const express = require("express");
const router = express.Router();

const {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  obtenerCurvasOMS,
  eliminarControl,
} = require("../controllers/crecimientoController");

const { verificarToken } = require("../middleware/authMiddleware");

router.use(verificarToken);

router.post("/", registrarControl);

// Historial de crecimiento de un paciente
router.get("/paciente/:id", obtenerHistorial);

// Curvas y datos de referencia OMS para un paciente
router.get("/paciente/:id/curvas-oms", obtenerCurvasOMS);

// Consultar un control individual
router.get("/:id", obtenerControl);

// Eliminar un control
router.delete("/:id", eliminarControl);

module.exports = router;
