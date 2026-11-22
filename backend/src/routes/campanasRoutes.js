const express = require("express");
const router = express.Router();

const {
  previsualizarCampana,
  crearCampana,
  listarCampanas,
  obtenerCampana,
} = require("../controllers/campanasController");

const { verificarToken, verificarRol } = require("../middleware/authMiddleware");

router.use(verificarToken);

// El encargado del centro supervisa y programa campañas.
router.post(
  "/previsualizar",
  verificarRol("admin", "encargado_centro"),
  previsualizarCampana
);
router.post(
  "/",
  verificarRol("admin", "encargado_centro"),
  crearCampana
);

// Los tres roles pueden consultar campañas.
router.get("/", listarCampanas);
router.get("/:id", obtenerCampana);

module.exports = router;
