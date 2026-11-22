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

const {
  verificarToken,
  verificarRol,
} = require("../middleware/authMiddleware");

// Ruta pública: requiere token QR y PIN.
router.post("/acceso", accederCarnet);

// Administración del carnet: personal autorizado.
router.use(verificarToken);

router.post(
  "/paciente/:id/generar",
  verificarRol("admin", "medico", "enfermero"),
  generarCarnet
);

router.get(
  "/paciente/:id",
  verificarRol("admin", "medico", "enfermero", "recepcion"),
  obtenerCarnetPaciente
);

router.post(
  "/:id/pdf",
  verificarRol("admin", "medico", "enfermero", "recepcion"),
  descargarPdfCarnet
);

router.post(
  "/:id/enviar-correo",
  verificarRol("admin", "medico", "enfermero"),
  enviarCarnetPorCorreo
);

router.patch(
  "/:id/revocar",
  verificarRol("admin", "medico", "enfermero"),
  revocarCarnet
);

module.exports = router;
