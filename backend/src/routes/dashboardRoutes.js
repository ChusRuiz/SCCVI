const express = require("express");
const router = express.Router();

const { verificarToken } = require("../middleware/authMiddleware");
const { obtenerDashboard } = require("../controllers/dashboardController");

router.use(verificarToken);

router.get("/", obtenerDashboard);

module.exports = router;