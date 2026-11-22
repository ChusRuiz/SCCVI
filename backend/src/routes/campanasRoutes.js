const express = require("express");
const router = express.Router();

const {
  previsualizarCampana,
  crearCampana,
  listarCampanas,
  obtenerCampana,
} = require("../controllers/campanasController");

const {
  verificarToken,
  verificarRol,
} = require("../middleware/authMiddleware");

router.use(verificarToken);

// Personal de salud y administración pueden preparar campañas.
router.post(
  "/previsualizar",
  verificarRol("admin", "medico", "enfermero"),
  previsualizarCampana
);
router.post(
  "/",
  verificarRol("admin", "medico", "enfermero"),
  crearCampana
);

router.get("/", listarCampanas);
router.get("/:id", obtenerCampana);

module.exports = router;
