
const express = require("express");
const router = express.Router();

const {
  crearComunidad,
  listarComunidades,
  obtenerComunidad,
  actualizarComunidad,
  desactivarComunidad,
  activarComunidad,
} = require("../controllers/comunidadController");

const {
  verificarToken,
} = require("../middleware/authMiddleware");

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Registrar comunidad
router.post("/", crearComunidad);

// Listar y buscar comunidades
router.get("/", listarComunidades);

// Consultar comunidad individual
router.get("/:id", obtenerComunidad);

// Actualizar comunidad
router.put("/:id", actualizarComunidad);

// Desactivar comunidad
router.patch("/:id/desactivar", desactivarComunidad);

// Reactivar comunidad
router.patch("/:id/activar", activarComunidad);

module.exports = router;
