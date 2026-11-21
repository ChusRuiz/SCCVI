const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Servidor SCCVI funcionando correctamente",
    sistema: "Sistema de Control de Crecimiento y Vacunacion Infantil",
    estado: "Activo"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API SCCVI disponible"
  });
});

app.listen(PORT, () => {
  console.log(`SCCVI activo en http://localhost:${PORT}`);
});
