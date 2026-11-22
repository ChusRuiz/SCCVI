const { validarConfiguracionBase } = require("./config/env");
const { puerto: PORT, entorno } = validarConfiguracionBase();

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
const notificacionesRoutes = require("./routes/notificacionesRoutes");
const carnetQrRoutes = require("./routes/carnetQrRoutes");
const campanasRoutes = require("./routes/campanasRoutes");
const reportesRoutes = require("./routes/reportesRoutes");
const { protegerApi } = require("./middleware/rolesMiddleware");
const usuariosRoutes = require("./routes/usuariosRoutes");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const origenesConfigurados = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);

const origenesPermitidos = entorno === "production"
  ? origenesConfigurados
  : [...new Set([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...origenesConfigurados,
    ])];

const corsOptions = {
  origin(origen, callback) {
    // Peticiones servidor-servidor y health checks no incluyen Origin.
    if (!origen || origenesPermitidos.includes(origen)) {
      return callback(null, true);
    }
    return callback(new Error("Origen no permitido por la política CORS."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// Liveness: verifica que el proceso HTTP esté activo, sin depender de PostgreSQL.
app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "OK", service: "sccvi-api" });
});

// Readiness: comprueba que la API puede utilizar la base de datos.
app.get("/health/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "OK", database: "connected" });
  } catch (error) {
    console.error("Readiness check falló:", error.message);
    res.status(503).json({ status: "ERROR", database: "unavailable" });
  }
});

app.get("/", (req, res) => {
  res.json({ sistema: "SCCVI", mensaje: "API funcionando correctamente", estado: "Activo" });
});

// Las rutas /api conservan la autenticación y autorización centralizadas.
app.use("/api", protegerApi);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/pacientes", pacienteRoutes);
app.use("/api/crecimiento", crecimientoRoutes);
app.use("/api/vacunacion", vacunacionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/comunidades", comunidadRoutes);
app.use("/api/padres", padreRoutes);
app.use("/api/alertas", alertasRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/carnets", carnetQrRoutes);
app.use("/api/campanas", campanasRoutes);
app.use("/api/reportes", reportesRoutes);

// Compatibilidad con el health check que ya utiliza el proyecto.
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS fecha");
    res.json({ status: "OK", database: "Conectada", fecha: result.rows[0].fecha });
  } catch (error) {
    res.status(503).json({ status: "ERROR", database: "No conectada" });
  }
});

app.get("/api/protegido", verificarToken, (req, res) => {
  res.json({ mensaje: "Acceso autorizado", usuario: req.usuario });
});

// Errores de CORS y errores no controlados siempre responden JSON.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const esCors = error.message === "Origen no permitido por la política CORS.";
  if (!esCors) console.error("Error HTTP no controlado:", error);
  return res.status(esCors ? 403 : 500).json({
    success: false,
    mensaje: esCors ? error.message : "Error interno del servidor.",
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`SCCVI API escuchando en puerto ${PORT} (${entorno}).`);
  console.log("Procesos automáticos y polling Telegram se ejecutan en src/worker.js.");
});

let cerrando = false;
async function cerrarServidor(signal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`Señal ${signal} recibida. Cerrando API...`);

  server.close(async () => {
    try {
      await pool.end();
      console.log("Conexiones PostgreSQL cerradas.");
      process.exit(0);
    } catch (error) {
      console.error("Error cerrando PostgreSQL:", error.message);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 25000).unref();
}

process.once("SIGTERM", () => cerrarServidor("SIGTERM"));
process.once("SIGINT", () => cerrarServidor("SIGINT"));

module.exports = app;
