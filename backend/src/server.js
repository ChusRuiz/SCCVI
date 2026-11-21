const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
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
      mensaje: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SCCVI activo en http://localhost:${PORT}`);
});