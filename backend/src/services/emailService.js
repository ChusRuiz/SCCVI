const nodemailer = require("nodemailer");

let transporter = null;

function obtenerTransporter() {
  if (transporter) {
    return transporter;
  }

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Faltan las variables de configuración SMTP en .env"
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",

    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS.replace(/\s/g, "")
    }
  });

  return transporter;
}

async function verificarConexionCorreo() {
  const servicio = obtenerTransporter();

  await servicio.verify();

  return {
    conectado: true,
    servidor: process.env.SMTP_HOST
  };
}

async function enviarCorreo({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error(
      "Destinatario, asunto y contenido son obligatorios."
    );
  }

  const servicio = obtenerTransporter();

  const resultado = await servicio.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });

  return {
    messageId: resultado.messageId,
    accepted: resultado.accepted
  };
}

module.exports = {
  verificarConexionCorreo,
  enviarCorreo
};