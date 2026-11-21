
const express = require("express");
const router = express.Router();

const {
  listarAlertas,
  obtenerEstadisticas,
  obtenerAlerta,
  revisarAlerta,
  resolverAlerta,
  descartarAlerta,
  generarAlertasManual,
} = require("../controllers/alertasController");

const {
  verificarToken,
} = require("../middleware/authMiddleware");

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Generar alertas manualmente
router.post("/generar", generarAlertasManual);

// Estadísticas
router.get("/estadisticas", obtenerEstadisticas);

// Listar alertas
router.get("/", listarAlertas);

// Consultar una alerta
router.get("/:id", obtenerAlerta);

// Cambiar estado
router.patch("/:id/revisar", revisarAlerta);
router.patch("/:id/resolver", resolverAlerta);
router.patch("/:id/descartar", descartarAlerta);

module.exports = router;
