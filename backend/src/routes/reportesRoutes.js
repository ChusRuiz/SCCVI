const express = require("express");
const router = express.Router();

const { verificarToken, verificarRol } = require("../middleware/authMiddleware");
const {
  obtenerResumenReportes,
  obtenerBajoPeso,
  obtenerSobrepeso,
  obtenerVacunasIncompletas,
  obtenerCoberturaComunidad,
  obtenerCrecimientoPromedioComunidad,
} = require("../controllers/reportesController");

router.use(verificarToken);
router.use(verificarRol("admin", "personal_salud", "encargado_centro"));

router.get("/resumen", obtenerResumenReportes);
router.get("/bajo-peso", obtenerBajoPeso);
router.get("/sobrepeso", obtenerSobrepeso);
router.get("/vacunas-incompletas", obtenerVacunasIncompletas);
router.get("/cobertura-comunidad", obtenerCoberturaComunidad);
router.get("/crecimiento-promedio-comunidad", obtenerCrecimientoPromedioComunidad);

module.exports = router;
