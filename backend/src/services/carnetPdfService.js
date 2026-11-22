const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

function fechaLocal(valor) {
  if (!valor) return "No registrada";
  const texto = String(valor).slice(0, 10);
  const [anio, mes, dia] = texto.split("-").map(Number);
  if (!anio || !mes || !dia) return "No registrada";
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function crearPdfCarnet({ token, paciente, carnet }) {
  return new Promise(async (resolve, reject) => {
    try {
      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
      const urlPublica = `${frontendUrl}/carnet/${token}`;
      const qrBuffer = await QRCode.toBuffer(urlPublica, {
        type: "png",
        errorCorrectionLevel: "H",
        width: 420,
        margin: 2,
      });

      const doc = new PDFDocument({
        size: [480, 300],
        margin: 0,
        info: {
          Title: `Carnet digital SCCVI - ${paciente.nombres} ${paciente.apellidos}`,
          Author: "SCCVI",
          Subject: "Carnet digital infantil",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Tarjeta blanca con encabezado institucional teal.
      doc.rect(0, 0, 480, 300).fill("#ffffff");
      doc.rect(0, 0, 480, 58).fill("#0f9f98");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(19)
        .text("SCCVI", 26, 17, { continued: true });
      doc.font("Helvetica").fontSize(10).text("  Carnet digital infantil", { baseline: "alphabetic" });

      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8)
        .text("EXPEDIENTE INFANTIL", 26, 78);

      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(17)
        .text(`${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim(), 26, 96, {
          width: 280,
          ellipsis: true,
        });

      doc.fillColor("#475569").font("Helvetica").fontSize(10);
      doc.text(`Fecha de nacimiento: ${fechaLocal(paciente.fecha_nacimiento)}`, 26, 130, { width: 275 });
      doc.text(`Sexo: ${paciente.sexo === "masculino" ? "Masculino" : paciente.sexo === "femenino" ? "Femenino" : "No registrado"}`, 26, 150, { width: 275 });
      doc.text(`Comunidad: ${paciente.comunidad || "Sin comunidad asignada"}`, 26, 170, { width: 275 });
      doc.text(`Carnet generado: ${fechaLocal(carnet.creado_en || new Date())}`, 26, 190, { width: 275 });

      doc.roundedRect(330, 77, 124, 124, 10).lineWidth(1).strokeColor("#dbe5ee").stroke();
      doc.image(qrBuffer, 339, 86, { fit: [106, 106] });
      doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(8)
        .text("ESCANEAR PARA CONSULTAR", 315, 210, { width: 155, align: "center" });

      doc.moveTo(26, 235).lineTo(454, 235).strokeColor("#e2e8f0").lineWidth(1).stroke();
      doc.fillColor("#334155").font("Helvetica-Bold").fontSize(9)
        .text("Acceso protegido por QR y PIN", 26, 248);
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
        .text("El PIN se entrega por separado en el centro de salud. No comparta este carnet públicamente.", 26, 264, {
          width: 425,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { crearPdfCarnet };
