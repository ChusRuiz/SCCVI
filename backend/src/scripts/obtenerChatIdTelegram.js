require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env")
});

async function obtenerChatId() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new Error("No se encontró TELEGRAM_BOT_TOKEN en .env");
    }

    const respuesta = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`
    );

    const datos = await respuesta.json();

    if (!datos.ok) {
      throw new Error(datos.description);
    }

    const conversaciones = datos.result
      .filter(update => update.message?.chat)
      .map(update => ({
        chat_id: update.message.chat.id,
        nombre: update.message.from?.first_name,
        usuario: update.message.from?.username
      }));

    console.log("Conversaciones encontradas:");
    console.table(conversaciones);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

obtenerChatId();