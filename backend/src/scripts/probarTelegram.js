require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env")
});

async function probarTelegram() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = "941695669";

    const respuesta = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "¡Prueba exitosa! SCCVI ya puede enviarte notificaciones por Telegram."
        })
      }
    );

    const resultado = await respuesta.json();

    if (!resultado.ok) {
      throw new Error(resultado.description);
    }

    console.log("Mensaje enviado correctamente.");
  } catch (error) {
    console.error("Error al enviar:", error.message);
  }
}

probarTelegram();