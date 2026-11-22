const fs = require("fs");
const { Pool } = require("pg");
require("dotenv").config();

const sslHabilitado = process.env.DB_SSL === "true";
let ssl = false;

if (sslHabilitado) {
  const sslOptions = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };

  if (process.env.DB_SSL_CA_PATH) {
    sslOptions.ca = fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8");
  }

  ssl = sslOptions;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  keepAlive: true,
  application_name: process.env.DB_APPLICATION_NAME || "sccvi",
});

pool.on("connect", () => {
  console.log("Conexión PostgreSQL establecida.");
});

pool.on("error", (error) => {
  console.error("Error inesperado en el pool PostgreSQL:", error.message);
});

module.exports = pool;
