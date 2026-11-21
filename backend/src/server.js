const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { verificarToken } = require("./middleware/authMiddleware");
const pacienteRoutes = require("./routes/pacienteRoutes");
const crecimientoRoutes = require("./routes/crecimientoRoutes");
const vacunacionRoutes = require("./routes/vacunacionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const comunidadRoutes = require("./routes/comunidadRoutes");
const padreRoutes = require("./routes/padreRoutes");
const alertasRoutes = require("./routes/alertasRoutes");
const { iniciarNotificacionesJob} = require("./jobs/notificacionesJob");
const notificacionesRoutes = require("./routes/notificacionesRoutes");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    sistema: "SCCVI",
    mensaje: "API funcionando correctamente",
    estado: "Activo",
  });
});

// Autenticación
app.use("/api/auth", authRoutes);
app.use("/api/pacientes", pacienteRoutes);
app.use("/api/crecimiento", crecimientoRoutes);
app.use("/api/vacunacion", vacunacionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/comunidades", comunidadRoutes);
app.use("/api/padres", padreRoutes);
app.use("/api/alertas", alertasRoutes);
app.use("/api/notificaciones", notificacionesRoutes);

// Verificar conexión a PostgreSQL
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS fecha");

    res.json({
      status: "OK",
      database: "Conectada",
      fecha: result.rows[0].fecha,
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      database: "No conectada",
    });
  }
});

// Ruta protegida de prueba
app.get("/api/protegido", verificarToken, (req, res) => {
  res.json({
    mensaje: "Acceso autorizado",
    usuario: req.usuario,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);

  iniciarNotificacionesJob();
});