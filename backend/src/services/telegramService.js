const enviarMensajeTelegram = async (chatId, mensaje) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new Error("No se encontró el token de Telegram.");
    }

    if (!chatId || !mensaje) {
      throw new Error("Se requiere un chat_id y un mensaje.");
    }

    const respuesta = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensaje
        })
      }
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(
        resultado.description || "No se pudo enviar el mensaje."
      );
    }

    return {
      exitoso: true,
      messageId: resultado.result.message_id,
      chatId: resultado.result.chat.id
    };

  } catch (error) {
    console.error("Error en Telegram:", error.message);
    throw error;
  }
};

module.exports = { enviarMensajeTelegram };