const express = require("express");
const router = express.Router();

const {
  crearPaciente,
  listarPacientes,
  obtenerPaciente,
  actualizarPaciente,
  desactivarPaciente,
} = require("../controllers/pacienteController");

const { verificarToken } = require("../middleware/authMiddleware");

// Todas las rutas requieren autenticación
router.use(verificarToken);

router.post("/", crearPaciente);
router.get("/", listarPacientes);
router.get("/:id", obtenerPaciente);
router.put("/:id", actualizarPaciente);
router.patch("/:id/desactivar", desactivarPaciente);

module.exports = router;