const dotenv = require("dotenv");

dotenv.config();

function exigir(nombre) {
  const valor = String(process.env[nombre] || "").trim();
  if (!valor) throw new Error(`Falta la variable obligatoria ${nombre}.`);
  return valor;
}

function validarConfiguracionBase() {
  const entorno = process.env.NODE_ENV || "development";
  const puerto = Number(process.env.PORT || 3000);

  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error("PORT debe ser un número entre 1 y 65535.");
  }

  exigir("DB_HOST");
  exigir("DB_NAME");
  exigir("DB_USER");
  exigir("DB_PASSWORD");
  exigir("JWT_SECRET");

  if (process.env.JWT_SECRET.length < 32) {
    if (entorno === "production") {
      throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");
    }
    console.warn("[SCCVI] JWT_SECRET local es corto; usa uno aleatorio de al menos 32 caracteres.");
  }

  if (entorno === "production") {
    exigir("FRONTEND_URL");
    exigir("CORS_ORIGINS");

    if (process.env.DB_SSL !== "true") {
      throw new Error("En producción DB_SSL debe ser true para cifrar la conexión a PostgreSQL.");
    }

    if (process.env.DB_SSL_REJECT_UNAUTHORIZED === "false") {
      throw new Error("No se permite desactivar la validación del certificado TLS de PostgreSQL en producción.");
    }

    const frontendUrl = new URL(process.env.FRONTEND_URL);
    if (frontendUrl.protocol !== "https:") {
      throw new Error("FRONTEND_URL debe utilizar HTTPS en producción.");
    }
  }

  return { entorno, puerto };
}

function validarConfiguracionWorker() {
  validarConfiguracionBase();
  exigir("TELEGRAM_BOT_TOKEN");
  exigir("TELEGRAM_BOT_USERNAME");
  exigir("SMTP_HOST");
  exigir("SMTP_USER");
  exigir("SMTP_PASS");
}

module.exports = {
  validarConfiguracionBase,
  validarConfiguracionWorker,
};
