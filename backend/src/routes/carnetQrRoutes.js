const express = require("express");
const router = express.Router();

const {
  generarCarnet,
  obtenerCarnetPaciente,
  revocarCarnet,
  accederCarnet,
} = require("../controllers/carnetQrController");

const {
  descargarPdfCarnet,
  enviarCarnetPorCorreo,
} = require("../controllers/carnetQrAccionesController");

const { verificarToken, verificarRol } = require("../middleware/authMiddleware");

// Ruta pública: el propio token QR y el PIN protegen el acceso.
router.post("/acceso", accederCarnet);

router.use(verificarToken);

router.post(
  "/paciente/:id/generar",
  verificarRol("admin", "personal_salud"),
  generarCarnet
);

router.get(
  "/paciente/:id",
  verificarRol("admin", "personal_salud", "encargado_centro"),
  obtenerCarnetPaciente
);

router.post(
  "/:id/pdf",
  verificarRol("admin", "personal_salud", "encargado_centro"),
  descargarPdfCarnet
);

router.post(
  "/:id/enviar-correo",
  verificarRol("admin", "personal_salud"),
  enviarCarnetPorCorreo
);

router.patch(
  "/:id/revocar",
  verificarRol("admin", "personal_salud"),
  revocarCarnet
);

module.exports = router;
