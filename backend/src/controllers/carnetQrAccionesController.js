const crypto = require("crypto");
const pool = require("../config/db");
const { crearPdfCarnet } = require("../services/carnetPdfService");
const { enviarCorreo } = require("../services/emailService");

function tokenValido(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

async function obtenerCarnetConPaciente(idCarnet, token) {
  if (!tokenValido(token)) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const resultado = await pool.query(
    `SELECT
       c.id_carnet,
       c.id_paciente,
       c.estado,
       c.creado_en,
       c.fecha_expiracion,
       c.token_hash,
       p.nombres,
       p.apellidos,
       p.fecha_nacimiento,
       p.sexo,
       p.estado AS estado_paciente,
       co.nombre AS comunidad
     FROM carnets_qr c
     INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
     LEFT JOIN comunidades co ON co.id_comunidad = p.id_comunidad
     WHERE c.id_carnet = $1
       AND c.token_hash = $2
       AND c.estado = 'activo'
       AND p.estado = 'activo'
       AND (c.fecha_expiracion IS NULL OR c.fecha_expiracion > NOW())
     LIMIT 1`,
    [idCarnet, tokenHash]
  );

  return resultado.rows[0] || null;
}

// Genera un PDF listo para descargar o imprimir. Se exige JWT y el token del QR actual.
const descargarPdfCarnet = async (req, res) => {
  const idCarnet = Number(req.params.id);
  const token = String(req.body?.token || "").trim();

  if (!Number.isInteger(idCarnet) || idCarnet <= 0) {
    return res.status(400).json({ success: false, mensaje: "Identificador de carnet no válido." });
  }

  try {
    const carnet = await obtenerCarnetConPaciente(idCarnet, token);
    if (!carnet) {
      return res.status(404).json({ success: false, mensaje: "El carnet no existe, fue revocado o el QR ya no es válido." });
    }

    const pdf = await crearPdfCarnet({ token, paciente: carnet, carnet });
    const nombre = `Carnet_SCCVI_${carnet.id_paciente}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });

    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Error al generar PDF del carnet:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo generar el PDF del carnet." });
  }
};

// Envía el PDF al correo de un padre/tutor asociado al paciente.
// El destinatario nunca se acepta directamente desde el navegador.
const enviarCarnetPorCorreo = async (req, res) => {
  const idCarnet = Number(req.params.id);
  const idPadre = Number(req.body?.id_padre);
  const token = String(req.body?.token || "").trim();

  if (!Number.isInteger(idCarnet) || idCarnet <= 0 || !Number.isInteger(idPadre) || idPadre <= 0) {
    return res.status(400).json({ success: false, mensaje: "Carnet o padre seleccionado no válido." });
  }

  try {
    const carnet = await obtenerCarnetConPaciente(idCarnet, token);
    if (!carnet) {
      return res.status(404).json({ success: false, mensaje: "El carnet no existe, fue revocado o el QR ya no es válido." });
    }

    const padreResult = await pool.query(
      `SELECT pf.id_padre, pf.nombres, pf.apellidos, pf.correo
       FROM padres_pacientes pp
       INNER JOIN padres_familia pf ON pf.id_padre = pp.id_padre
       WHERE pp.id_paciente = $1
         AND pp.id_padre = $2
         AND pf.estado = 'activo'
         AND pf.correo IS NOT NULL
         AND BTRIM(pf.correo) <> ''
       LIMIT 1`,
      [carnet.id_paciente, idPadre]
    );

    if (!padreResult.rowCount) {
      return res.status(404).json({ success: false, mensaje: "El padre seleccionado no está asociado al paciente o no tiene correo registrado." });
    }

    const padre = padreResult.rows[0];
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const urlPublica = `${frontendUrl}/carnet/${token}`;
    const pdf = await crearPdfCarnet({ token, paciente: carnet, carnet });

    await enviarCorreo({
      to: padre.correo,
      subject: `Carnet digital de ${carnet.nombres} ${carnet.apellidos} - SCCVI`,
      text:
        `Hola ${padre.nombres} ${padre.apellidos}.\n\n` +
        `Adjuntamos el carnet digital de ${carnet.nombres} ${carnet.apellidos}.\n` +
        `También puedes abrirlo desde este enlace: ${urlPublica}\n\n` +
        `Por seguridad, el PIN de acceso NO está incluido en este correo. ` +
        `Solicítalo o consérvalo por separado.\n\n` +
        `Centro de salud - SCCVI`,
      html:
        `<p>Hola ${escapeHtml(padre.nombres)} ${escapeHtml(padre.apellidos)},</p>` +
        `<p>Adjuntamos el carnet digital de <strong>${escapeHtml(carnet.nombres)} ${escapeHtml(carnet.apellidos)}</strong>.</p>` +
        `<p><a href="${escapeHtml(urlPublica)}">Abrir carnet digital</a></p>` +
        `<p>Por seguridad, el PIN de acceso no está incluido en este correo. Debe conservarse y entregarse por separado.</p>` +
        `<p>Centro de salud - SCCVI</p>`,
      attachments: [{
        filename: `Carnet_SCCVI_${carnet.id_paciente}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      }],
    });

    return res.json({
      success: true,
      mensaje: "Carnet enviado correctamente al correo del padre seleccionado.",
      destinatario: padre.correo,
    });
  } catch (error) {
    console.error("Error enviando carnet por correo:", error);
    return res.status(500).json({ success: false, mensaje: "No se pudo enviar el carnet por correo." });
  }
};

function escapeHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[caracter]));
}

module.exports = {
  descargarPdfCarnet,
  enviarCarnetPorCorreo,
};
