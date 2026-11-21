const express = require("express");
const router = express.Router();

const {
  generarCarnet,
  obtenerCarnetPaciente,
  revocarCarnet,
  accederCarnet,
} = require("../controllers/carnetQrController");

const {
  verificarToken,
  verificarRol,
} = require("../middleware/authMiddleware");

// Esta ruta es pública, pero exige el token QR y el PIN.
router.post("/acceso", accederCarnet);

// Administración de carnets: solo personal autorizado.
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

router.patch(
  "/:id/revocar",
  verificarRol("admin", "medico", "enfermero"),
  revocarCarnet
);

module.exports = router;
