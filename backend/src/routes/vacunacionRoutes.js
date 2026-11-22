const express = require("express");
const router = express.Router();

const {
  verificarToken,
  verificarRol,
} = require("../middleware/authMiddleware");

const {
  obtenerVacunas,
  crearVacuna,
  desactivarVacuna,
  activarVacuna,
  registrarVacunacion,
  historialVacunacion,
  proximasDosis,
} = require("../controllers/vacunacionController");

router.use(verificarToken);

// Catálogo: lectura para personal autenticado; administración solo admin.
router.get("/vacunas", obtenerVacunas);
router.post("/vacunas", verificarRol("admin"), crearVacuna);
router.patch("/vacunas/:id/desactivar", verificarRol("admin"), desactivarVacuna);
router.patch("/vacunas/:id/activar", verificarRol("admin"), activarVacuna);

// Registro clínico: solo administrador, médico o enfermero.
router.post("/", verificarRol("admin", "medico", "enfermero"), registrarVacunacion);
router.get("/paciente/:id", historialVacunacion);
router.get("/proximas-dosis", proximasDosis);

module.exports = router;
