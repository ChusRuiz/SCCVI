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
  registrarVacunacion,
  historialVacunacion,
  proximasDosis,
} = require("../controllers/vacunacionController");


router.use(verificarToken);


router.get("/vacunas", obtenerVacunas);
router.post("/vacunas", verificarRol("admin"), crearVacuna);
router.patch(
  "/vacunas/:id/desactivar",
  verificarRol("admin"),
  desactivarVacuna
);


router.post("/", registrarVacunacion);
router.get("/paciente/:id", historialVacunacion);
router.get("/proximas-dosis", proximasDosis);

module.exports = router;