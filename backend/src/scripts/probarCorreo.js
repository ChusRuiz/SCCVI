require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env")
});

const {
  verificarConexionCorreo,
  enviarCorreo
} = require("../services/emailService");

async function ejecutar() {
  try {
    
    console.log("Verificando conexión con Gmail...");

    const conexion = await verificarConexionCorreo();

    console.log("Conexión SMTP exitosa:", conexion.servidor);

    const resultado = await enviarCorreo({
      to: process.env.SMTP_TEST_TO,
      subject: "Prueba de correo - SCCVI",
      text:
        "Prueba técnica de SCCVI.\n\n" +
        "La conexión de correo electrónico funciona correctamente.\n\n" +
        "Este mensaje no corresponde a una alerta médica."
    });
    console.log("Destinatario de prueba:", process.env.SMTP_TEST_TO);
    console.log("Correo enviado correctamente.");
    console.log("ID del mensaje:", resultado.messageId);

  } catch (error) {
    console.error("Error al probar correo:", error.message);

  }
}

ejecutar();