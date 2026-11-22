const crypto = require("crypto");
const pool = require("../config/db");

let iniciado = false;
let offset = 0;
let botInfo = null;
let pollingAbortController = null;

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hashCodigo(codigo) {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

async function telegramRequest(metodo, body = {}, signal) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN.");

  const response = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal || AbortSignal.timeout(35000),
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API ${metodo} devolvió un error.`);
  }
  return result.result;
}

async function responder(chatId, texto) {
  try {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: texto,
      disable_web_page_preview: true,
    });
  } catch (error) {
    console.error("No se pudo responder al chat de vinculación:", error.message);
  }
}

async function procesarCodigoVinculacion(codigo, chat, from) {
  const client = await pool.connect();
  let transaccion = false;

  try {
    await client.query("BEGIN");
    transaccion = true;

    const codigoHash = hashCodigo(codigo);
    const consulta = await client.query(
      `SELECT
          v.id_vinculacion,
          v.id_padre,
          v.estado AS estado_vinculacion,
          v.expira_en,
          p.nombres,
          p.apellidos,
          p.estado AS estado_padre,
          p.telegram_chat_id
       FROM vinculaciones_telegram v
       INNER JOIN padres_familia p ON p.id_padre = v.id_padre
       WHERE v.codigo_hash = $1
       FOR UPDATE OF v`,
      [codigoHash]
    );

    if (!consulta.rows.length) {
      await client.query("COMMIT");
      transaccion = false;
      return { ok: false, mensaje: "El enlace no es válido. Solicita uno nuevo al centro de salud." };
    }

    const vinculo = consulta.rows[0];

    if (vinculo.estado_vinculacion !== "pendiente") {
      await client.query("COMMIT");
      transaccion = false;
      return { ok: false, mensaje: "Este enlace ya fue utilizado o revocado. Solicita uno nuevo al centro de salud." };
    }

    if (new Date(vinculo.expira_en).getTime() <= Date.now()) {
      await client.query(
        `UPDATE vinculaciones_telegram
         SET estado = 'expirado', actualizado_en = NOW()
         WHERE id_vinculacion = $1`,
        [vinculo.id_vinculacion]
      );
      await client.query("COMMIT");
      transaccion = false;
      return { ok: false, mensaje: "El enlace venció. Solicita uno nuevo al centro de salud." };
    }

    if (vinculo.estado_padre !== "activo") {
      await client.query(
        `UPDATE vinculaciones_telegram
         SET estado = 'revocado', actualizado_en = NOW()
         WHERE id_vinculacion = $1`,
        [vinculo.id_vinculacion]
      );
      await client.query("COMMIT");
      transaccion = false;
      return { ok: false, mensaje: "El registro del padre está inactivo. Contacta al centro de salud." };
    }

    const chatId = String(chat.id);
    const otraCuenta = await client.query(
      `SELECT id_padre
       FROM padres_familia
       WHERE telegram_chat_id = $1
         AND id_padre <> $2
       LIMIT 1`,
      [chatId, vinculo.id_padre]
    );

    if (otraCuenta.rows.length) {
      await client.query(
        `UPDATE vinculaciones_telegram
         SET estado = 'rechazado', actualizado_en = NOW()
         WHERE id_vinculacion = $1`,
        [vinculo.id_vinculacion]
      );
      await client.query("COMMIT");
      transaccion = false;
      return { ok: false, mensaje: "Esta cuenta de Telegram ya está vinculada a otro registro de SCCVI. Contacta al centro de salud." };
    }

    if (vinculo.telegram_chat_id && String(vinculo.telegram_chat_id) !== chatId) {
      await client.query("COMMIT");
      transaccion = false;
      return { ok: false, mensaje: "El registro ya tiene otra cuenta de Telegram vinculada. Contacta al centro de salud." };
    }

    const actualizacionPadre = await client.query(
      `UPDATE padres_familia
       SET telegram_chat_id = $1,
           canal_preferido = 'telegram'
       WHERE id_padre = $2
         AND estado = 'activo'
         AND (telegram_chat_id IS NULL OR telegram_chat_id = $1)
       RETURNING id_padre`,
      [chatId, vinculo.id_padre]
    );

    if (!actualizacionPadre.rows.length) {
      await client.query("ROLLBACK");
      transaccion = false;
      return { ok: false, mensaje: "No fue posible vincular esta cuenta. Contacta al centro de salud." };
    }

    await client.query(
      `UPDATE vinculaciones_telegram
       SET estado = 'vinculado',
           telegram_chat_id = $1,
           telegram_username = $2,
           telegram_nombre = $3,
           usado_en = NOW(),
           actualizado_en = NOW()
       WHERE id_vinculacion = $4`,
      [
        chatId,
        from.username || null,
        [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 150) || null,
        vinculo.id_vinculacion,
      ]
    );

    await client.query("COMMIT");
    transaccion = false;

    return {
      ok: true,
      mensaje: `¡Cuenta vinculada correctamente con SCCVI!\n\nRegistro asociado: ${vinculo.nombres} ${vinculo.apellidos}.\n\nA partir de ahora podrás recibir notificaciones por Telegram. Si no reconoces este registro, comunícate con el centro de salud.`,
    };
  } catch (error) {
    if (transaccion) {
      await client.query("ROLLBACK");
      transaccion = false;
    }
    if (error.code === "23505") {
      return {
        ok: false,
        mensaje: "Esta cuenta de Telegram ya fue vinculada a otro registro. Contacta al centro de salud.",
      };
    }
    throw error;
  } finally {
    client.release();
  }
}

async function procesarUpdate(update) {
  const message = update.message;
  if (!message || !message.chat) return;

  const chat = message.chat;
  if (chat.type !== "private") {
    await responder(chat.id, "Por seguridad, la vinculación de SCCVI solo se realiza en una conversación privada con el bot.");
    return;
  }

  const texto = String(message.text || "").trim();
  const coincidencia = texto.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]{1,64}))?/);

  if (!coincidencia || !coincidencia[1]) {
    await responder(chat.id, "Bienvenido a SCCVIhBot. Para vincular tu cuenta, solicita al personal del centro de salud un enlace personal y ábrelo desde esta conversación. Los enlaces vencen después de 10 minutos y solo pueden utilizarse una vez.");
    return;
  }

  const codigo = coincidencia[1];
  if (!/^[a-f0-9]{48}$/i.test(codigo)) {
    await responder(chat.id, "El código de vinculación no tiene un formato válido. Solicita un nuevo enlace al centro de salud.");
    return;
  }

  const resultado = await procesarCodigoVinculacion(codigo, chat, message.from || {});
  await responder(chat.id, resultado.mensaje);
}

async function guardarOffset(nuevoOffset) {
  await pool.query(
    `INSERT INTO telegram_polling_state (id, last_update_id, actualizado_en)
     VALUES (1, $1, NOW())
     ON CONFLICT (id)
     DO UPDATE SET last_update_id = EXCLUDED.last_update_id,
                   actualizado_en = NOW()`,
    [nuevoOffset]
  );
  offset = nuevoOffset;
}

async function ejecutarPolling() {
  const estado = await pool.query(
    `SELECT last_update_id FROM telegram_polling_state WHERE id = 1`
  );
  offset = Number(estado.rows[0]?.last_update_id || 0);

  while (iniciado) {
    try {
      pollingAbortController = new AbortController();
      const updates = await telegramRequest("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"],
      }, pollingAbortController.signal);
      pollingAbortController = null;

      for (const update of updates) {
        if (!iniciado) break;
        try {
          await procesarUpdate(update);
        } catch (error) {
          console.error("Error procesando actualización de Telegram:", error.message);
          await pausa(5000);
          break;
        }
        await guardarOffset(update.update_id + 1);
      }
    } catch (error) {
      pollingAbortController = null;
      if (!iniciado && error.name === "AbortError") break;
      console.error("Polling de Telegram detenido temporalmente:", error.message);
      if (iniciado) await pausa(5000);
    }
  }
}

async function iniciarTelegramPolling() {
  if (iniciado) return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[SCCVI] Vinculación Telegram desactivada: falta TELEGRAM_BOT_TOKEN.");
    return;
  }

  try {
    const [info, webhook] = await Promise.all([
      telegramRequest("getMe"),
      telegramRequest("getWebhookInfo"),
    ]);

    botInfo = info;

    if (webhook?.url) {
      console.error("[SCCVI] El bot ya tiene un webhook configurado. Desactívalo antes de utilizar long polling; no se modificó automáticamente.");
      return;
    }

    const esperado = String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").toLowerCase();
    if (esperado && info.username?.toLowerCase() !== esperado) {
      console.error(`[SCCVI] TELEGRAM_BOT_USERNAME no coincide con el bot del token (${info.username}). Revisa backend/.env.`);
      return;
    }

    iniciado = true;
    console.log(`[SCCVI] Vinculación automática Telegram activa para @${info.username}.`);
    ejecutarPolling().catch((error) => {
      iniciado = false;
      console.error("[SCCVI] Polling de Telegram no pudo continuar:", error.message);
    });
  } catch (error) {
    console.error("[SCCVI] No se pudo iniciar la vinculación automática de Telegram:", error.message);
  }
}

function detenerTelegramPolling() {
  iniciado = false;
  pollingAbortController?.abort();
  pollingAbortController = null;
}

module.exports = {
  iniciarTelegramPolling,
  detenerTelegramPolling,
};
