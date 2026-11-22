const express = require("express");
const router = express.Router();

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require("../controllers/usuariosController");

const { verificarToken, verificarRol } = require("../middleware/authMiddleware");

router.use(verificarToken, verificarRol("admin"));

router.get("/", listarUsuarios);
router.post("/", crearUsuario);
router.put("/:id", actualizarUsuario);
router.patch("/:id/estado", cambiarEstadoUsuario);

module.exports = router;
