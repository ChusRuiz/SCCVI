const express = require("express");
const router = express.Router();

const {
  listarNotificaciones,
  obtenerEstadisticasNotificaciones,
  obtenerNotificacion
} = require("../controllers/notificacionesController");

const {
  verificarToken
} = require("../middleware/authMiddleware");

router.use(verificarToken);

router.get("/estadisticas", obtenerEstadisticasNotificaciones);
router.get("/", listarNotificaciones);
router.get("/:id", obtenerNotificacion);

module.exports = router;