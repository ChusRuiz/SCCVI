const express = require("express");
const router = express.Router();

const {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  eliminarControl,
} = require("../controllers/crecimientoController");

const { verificarToken } = require("../middleware/authMiddleware");

router.use(verificarToken);

router.post("/", registrarControl);
router.get("/paciente/:id", obtenerHistorial);
router.get("/:id", obtenerControl);
router.delete("/:id", eliminarControl);

module.exports = router;