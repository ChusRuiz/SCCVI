import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  FileText,
  Mail,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserRound,
  LockKeyhole,
} from "lucide-react";
import api from "../services/api";

function fecha(valor) {
  if (!valor) return "—";
  const texto = String(valor).slice(0, 10);
  const [anio, mes, dia] = texto.split("-").map(Number);
  if (!anio || !mes || !dia) return "—";
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function extraerToken(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

export default function CarnetPacientePanel({ paciente, padres = [] }) {
  const pacienteId = paciente?.id_paciente;
  const [carnetEstado, setCarnetEstado] = useState(null);
  const [sesionCarnet, setSesionCarnet] = useState(null);
  const [pin, setPin] = useState("");
  const [padreSeleccionado, setPadreSeleccionado] = useState("");
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const padresConCorreo = useMemo(
    () => padres.filter((padre) => padre.correo && String(padre.correo).trim()),
    [padres]
  );

  useEffect(() => {
    const principal = padresConCorreo.find((padre) => padre.es_contacto_principal === true);
    const inicial = principal || padresConCorreo[0];
    setPadreSeleccionado(inicial ? String(inicial.id_padre) : "");
  }, [padresConCorreo]);

  const cargarEstado = async () => {
    if (!pacienteId) return;
    setCargandoEstado(true);
    try {
      const respuesta = await api.get(`/carnets/paciente/${pacienteId}`);
      setCarnetEstado(respuesta.data?.carnet || null);
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error.response?.data?.mensaje || "No se pudo consultar el estado del carnet.",
      });
    } finally {
      setCargandoEstado(false);
    }
  };

  useEffect(() => {
    cargarEstado();
    setSesionCarnet(null);
  }, [pacienteId]);

  const generarCarnet = async (evento) => {
    evento.preventDefault();
    setMensaje(null);

    if (!/^\d{6,12}$/.test(pin)) {
      setMensaje({ tipo: "error", texto: "El PIN debe contener entre 6 y 12 dígitos." });
      return;
    }

    const tieneCarnetActivo = carnetEstado?.estado === "activo";
    if (tieneCarnetActivo && !window.confirm(
      "Este paciente ya tiene un carnet activo. Al generar otro, el QR anterior quedará revocado. ¿Deseas continuar?"
    )) return;

    setGenerando(true);
    try {
      const respuesta = await api.post(`/carnets/paciente/${pacienteId}/generar`, { pin });
      const carnet = respuesta.data?.carnet;
      const token = extraerToken(carnet?.url_publica);

      if (!carnet?.id_carnet || !token || !carnet?.qr) {
        throw new Error("El backend no devolvió todos los datos del carnet QR.");
      }

      setSesionCarnet({ ...carnet, token });
      setCarnetEstado({
        id_carnet: carnet.id_carnet,
        estado: carnet.estado,
        creado_en: carnet.creado_en,
      });
      setPin("");
      setMensaje({ tipo: "success", texto: "Carnet generado correctamente. Descárgalo, imprímelo o envíalo por correo." });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error.response?.data?.mensaje || error.message || "No se pudo generar el carnet.",
      });
    } finally {
      setGenerando(false);
    }
  };

  const obtenerPdf = async () => {
    if (!sesionCarnet?.id_carnet || !sesionCarnet?.token) {
      throw new Error("Genera o renueva el carnet para disponer del QR actual.");
    }
    const respuesta = await api.post(
      `/carnets/${sesionCarnet.id_carnet}/pdf`,
      { token: sesionCarnet.token },
      { responseType: "blob" }
    );
    return respuesta.data;
  };

  const descargarPdf = async () => {
    setDescargando(true);
    setMensaje(null);
    try {
      const blob = await obtenerPdf();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `Carnet_SCCVI_${pacienteId}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMensaje({ tipo: "success", texto: "Carnet PDF descargado correctamente." });
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.mensaje || error.message || "No se pudo descargar el carnet." });
    } finally {
      setDescargando(false);
    }
  };

  const descargarQr = () => {
    if (!sesionCarnet?.qr) return;
    const enlace = document.createElement("a");
    enlace.href = sesionCarnet.qr;
    enlace.download = `QR_Carnet_SCCVI_${pacienteId}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  };

  const imprimirCarnet = async () => {
    // Abrir la ventana durante el gesto del usuario para evitar bloqueadores de ventanas emergentes.
    const ventana = window.open("about:blank", "_blank");
    setImprimiendo(true);
    setMensaje(null);
    try {
      const blob = await obtenerPdf();
      const url = URL.createObjectURL(blob);
      if (ventana) {
        ventana.location.href = url;
        ventana.onload = () => {
          ventana.focus();
          ventana.print();
        };
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMensaje({ tipo: "success", texto: "Carnet abierto en una nueva pestaña. Utiliza la opción Imprimir del visor PDF." });
      } else {
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `Carnet_SCCVI_${pacienteId}.pdf`;
        enlace.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        setMensaje({ tipo: "info", texto: "El navegador bloqueó la ventana de impresión; descargamos el PDF para que puedas imprimirlo." });
      }
    } catch (error) {
      if (ventana) ventana.close();
      setMensaje({ tipo: "error", texto: error.response?.data?.mensaje || error.message || "No se pudo preparar la impresión." });
    } finally {
      setImprimiendo(false);
    }
  };

  const enviarCorreo = async () => {
    if (!sesionCarnet?.id_carnet || !sesionCarnet?.token) return;
    const padre = padresConCorreo.find((item) => String(item.id_padre) === String(padreSeleccionado));
    if (!padre) {
      setMensaje({ tipo: "error", texto: "Selecciona un padre o tutor asociado que tenga correo registrado." });
      return;
    }

    const confirmar = window.confirm(
      `¿Enviar el carnet PDF de ${paciente.nombres} ${paciente.apellidos} a ${padre.nombres} ${padre.apellidos} (${padre.correo})? El PIN no se incluirá en el correo.`
    );
    if (!confirmar) return;

    setEnviando(true);
    setMensaje(null);
    try {
      const respuesta = await api.post(`/carnets/${sesionCarnet.id_carnet}/enviar-correo`, {
        token: sesionCarnet.token,
        id_padre: Number(padre.id_padre),
      });
      setMensaje({ tipo: "success", texto: respuesta.data?.mensaje || "Carnet enviado correctamente por correo." });
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.mensaje || "No se pudo enviar el carnet por correo." });
    } finally {
      setEnviando(false);
    }
  };

  const activo = carnetEstado?.estado === "activo";

  return (
    <section className="profile-content carnet-paciente-panel">
      <div className="profile-section-heading carnet-panel-heading">
        <div>
          <h3>Carnet digital con código QR</h3>
          <p>Genera, descarga, imprime o envía el carnet al correo de un padre o tutor asociado.</p>
        </div>
        <QrCode size={23} />
      </div>

      {mensaje && (
        <div className={`carnet-panel-message ${mensaje.tipo}`} role="status">
          {mensaje.tipo === "success" ? <BadgeCheck size={17} /> : <ShieldCheck size={17} />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div className="carnet-current-status">
        <div className="carnet-status-icon"><QrCode size={23} /></div>
        <div className="carnet-status-copy">
          <strong>{cargandoEstado ? "Consultando carnet..." : activo ? "El paciente tiene un carnet activo" : "El paciente todavía no tiene un carnet activo"}</strong>
          <span>
            {cargandoEstado
              ? "Verificando el estado del expediente."
              : activo
                ? `Generado el ${fecha(carnetEstado.creado_en)}. Por seguridad, el QR anterior no se puede recuperar; puedes renovarlo para generar uno nuevo.`
                : "Genera el primer carnet y establece un PIN que entregarás al padre por separado."}
          </span>
        </div>
        {activo && <span className="carnet-status-badge">Activo</span>}
      </div>

      {!sesionCarnet && (
        <form className="carnet-generate-form" onSubmit={generarCarnet}>
          <div className="carnet-pin-field">
            <label htmlFor={`carnet-pin-${pacienteId}`}>PIN de acceso (6 a 12 dígitos)</label>
            <input
              id={`carnet-pin-${pacienteId}`}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={12}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="Ingresa un PIN seguro"
              required
            />
          </div>
          <button className="carnet-action-btn primary" type="submit" disabled={generando || cargandoEstado}>
            {generando ? <RefreshCw className="spin" size={16} /> : <QrCode size={16} />}
            {generando ? "Generando..." : activo ? "Renovar y generar nuevo QR" : "Generar carnet QR"}
          </button>
        </form>
      )}

      {sesionCarnet && (
        <>
          <div className="carnet-preview-card">
            <div className="carnet-preview-data">
              <span className="carnet-eyebrow">CARNET DIGITAL INFANTIL</span>
              <h4>{paciente.nombres} {paciente.apellidos}</h4>
              <p><CalendarDays size={14} /> Nacimiento: {fecha(paciente.fecha_nacimiento)}</p>
              <p><UserRound size={14} /> {paciente.sexo === "masculino" ? "Masculino" : "Femenino"}</p>
              <p><LockKeyhole size={14} /> Acceso protegido por PIN</p>
            </div>
            <div className="carnet-preview-qr-wrap">
              <img src={sesionCarnet.qr} alt={`Código QR del carnet de ${paciente.nombres}`} />
              <small>Escanear para consultar</small>
            </div>
          </div>

          <div className="carnet-actions-grid">
            <button className="carnet-action-btn" type="button" onClick={descargarPdf} disabled={descargando || imprimiendo || enviando}>
              {descargando ? <RefreshCw className="spin" size={16} /> : <FileText size={16} />}
              Descargar carnet PDF
            </button>
            <button className="carnet-action-btn" type="button" onClick={descargarQr} disabled={!sesionCarnet.qr}>
              <Download size={16} /> Descargar QR PNG
            </button>
            <button className="carnet-action-btn" type="button" onClick={imprimirCarnet} disabled={descargando || imprimiendo || enviando}>
              {imprimiendo ? <RefreshCw className="spin" size={16} /> : <Printer size={16} />}
              Imprimir carnet
            </button>
          </div>

          <div className="carnet-email-box">
            <div>
              <h4><Mail size={17} /> Enviar carnet por correo</h4>
              <p>Se enviará el PDF al correo registrado del padre seleccionado. El PIN no se adjunta ni se incluye en el mensaje.</p>
            </div>
            {padresConCorreo.length > 0 ? (
              <div className="carnet-email-controls">
                <select value={padreSeleccionado} onChange={(event) => setPadreSeleccionado(event.target.value)}>
                  {padresConCorreo.map((padre) => (
                    <option key={padre.id_padre} value={padre.id_padre}>
                      {padre.nombres} {padre.apellidos} — {padre.correo}{padre.es_contacto_principal ? " (principal)" : ""}
                    </option>
                  ))}
                </select>
                <button className="carnet-action-btn primary" type="button" onClick={enviarCorreo} disabled={enviando || descargando || imprimiendo || !padreSeleccionado}>
                  {enviando ? <RefreshCw className="spin" size={16} /> : <Mail size={16} />}
                  {enviando ? "Enviando..." : "Enviar por correo"}
                </button>
              </div>
            ) : (
              <div className="carnet-no-email">No hay padres o tutores asociados con correo registrado.</div>
            )}
          </div>

          <div className="carnet-security-note">
            <ShieldCheck size={17} />
            <span>El QR contiene un enlace único. Entrega el PIN al padre por separado y conserva el carnet de forma privada.</span>
          </div>

          <button
            className="carnet-reset-link"
            type="button"
            onClick={() => {
              setSesionCarnet(null);
              setMensaje({ tipo: "info", texto: "El QR generado sigue activo. Si necesitas volver a mostrarlo, tendrás que renovarlo y establecer un nuevo PIN." });
            }}
          >
            Cerrar vista del QR
          </button>
        </>
      )}
    </section>
  );
}
