import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Users,
  UserRound,
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock3,
  CalendarClock,
  MapPin,
  Syringe,
  Stethoscope,
  Info,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  LoaderCircle,
  ShieldCheck,
  CalendarDays,
  FileText,
} from "lucide-react";
import api from "../services/api";

const LIMITE = 10;

const FORM_INICIAL = {
  titulo: "",
  tipo: "jornada_vacunacion",
  descripcion: "",
  mensaje: "",
  id_comunidad: "",
  edad_min_meses: "0",
  edad_max_meses: "60",
  filtro_vacunacion: "todos",
  fecha_programada: "",
};

const TIPOS = [
  { value: "jornada_vacunacion", label: "Jornada de vacunación", Icon: Syringe },
  { value: "control_medico", label: "Control médico", Icon: Stethoscope },
  { value: "informativa", label: "Informativa", Icon: Info },
];

const ESTADOS = {
  programada: { label: "Programada", className: "scheduled", Icon: Clock3 },
  enviando: { label: "Enviando", className: "sending", Icon: LoaderCircle },
  enviada: { label: "Enviada", className: "sent", Icon: CheckCircle2 },
  parcial: { label: "Envío parcial", className: "partial", Icon: AlertCircle },
  fallida: { label: "Fallida", className: "failed", Icon: AlertCircle },
  cancelada: { label: "Cancelada", className: "cancelled", Icon: X },
};

const ESTADOS_DESTINATARIO = {
  pendiente: { label: "Pendiente", className: "scheduled" },
  procesando: { label: "Procesando", className: "sending" },
  enviada: { label: "Enviada", className: "sent" },
  error: { label: "Error", className: "failed" },
};

function obtenerError(error, respaldo) {
  return error.response?.data?.mensaje || error.response?.data?.error || error.message || respaldo;
}

function formatearFecha(valor, incluirHora = true) {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    ...(incluirHora ? { timeStyle: "short" } : {}),
    timeZone: "America/Guatemala",
  }).format(fecha);
}

function fechaMinimaLocal() {
  const fecha = new Date();
  const desplazamiento = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - desplazamiento).toISOString().slice(0, 16);
}

function construirFiltros(formulario) {
  return {
    id_comunidad: formulario.id_comunidad ? Number(formulario.id_comunidad) : null,
    edad_min_meses: formulario.edad_min_meses === "" ? null : Number(formulario.edad_min_meses),
    edad_max_meses: formulario.edad_max_meses === "" ? null : Number(formulario.edad_max_meses),
    filtro_vacunacion: formulario.filtro_vacunacion,
  };
}

function firmaFiltros(filtros) {
  return JSON.stringify(filtros);
}

function InsigniaEstado({ estado }) {
  const config = ESTADOS[estado] || { label: estado || "Sin estado", className: "scheduled", Icon: Clock3 };
  const Icon = config.Icon;
  return (
    <span className={`campaign-status ${config.className}`}>
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function InsigniaCanal({ canal }) {
  const esTelegram = canal === "telegram";
  const Icon = esTelegram ? Send : Mail;
  return (
    <span className={`campaign-channel ${esTelegram ? "telegram" : "email"}`}>
      <Icon size={13} />
      {esTelegram ? "Telegram" : "Correo"}
    </span>
  );
}

function TarjetaResumen({ Icon, titulo, valor, detalle, variante = "" }) {
  return (
    <article className="campaign-summary-card">
      <div className={`campaign-summary-icon ${variante}`}><Icon size={19} /></div>
      <div className="campaign-summary-copy">
        <span>{titulo}</span>
        <strong>{Number(valor || 0).toLocaleString("es-GT")}</strong>
        <small>{detalle}</small>
      </div>
    </article>
  );
}

export default function Campanas() {
  const [formulario, setFormulario] = useState({ ...FORM_INICIAL });
  const [comunidades, setComunidades] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, limite: LIMITE, total: 0, total_paginas: 0 });
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [firmaPrevisualizada, setFirmaPrevisualizada] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [confirmacion, setConfirmacion] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [cargandoComunidades, setCargandoComunidades] = useState(true);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const filtrosActuales = useMemo(() => construirFiltros(formulario), [
    formulario.id_comunidad,
    formulario.edad_min_meses,
    formulario.edad_max_meses,
    formulario.filtro_vacunacion,
  ]);
  const firmaActual = useMemo(() => firmaFiltros(filtrosActuales), [filtrosActuales]);
  const previsualizacionVigente = Boolean(previsualizacion && firmaPrevisualizada === firmaActual);

  const cargarComunidades = useCallback(async () => {
    try {
      setCargandoComunidades(true);
      const response = await api.get("/comunidades", { params: { estado: "activa" } });
      const datos = Array.isArray(response.data)
        ? response.data
        : response.data?.comunidades || [];
      setComunidades(datos.filter((item) => !item.estado || item.estado === "activa"));
    } catch (err) {
      console.error("Error cargando comunidades para campañas:", err);
      setComunidades([]);
      setError(obtenerError(err, "No se pudieron cargar las comunidades."));
    } finally {
      setCargandoComunidades(false);
    }
  }, []);

  const cargarCampanas = useCallback(async (silencioso = false) => {
    try {
      if (silencioso) setActualizando(true);
      else setCargando(true);
      const response = await api.get("/campanas", {
        params: { pagina, limite: LIMITE },
      });
      const datos = Array.isArray(response.data?.data) ? response.data.data : [];
      setCampanas(datos);
      setPaginacion(response.data?.paginacion || {
        pagina,
        limite: LIMITE,
        total: datos.length,
        total_paginas: 1,
      });
    } catch (err) {
      console.error("Error cargando campañas:", err);
      setError(obtenerError(err, "No se pudo cargar el historial de campañas."));
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [pagina]);

  useEffect(() => {
    cargarComunidades();
  }, [cargarComunidades]);

  useEffect(() => {
    cargarCampanas();
  }, [cargarCampanas]);

  const cambiarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    if (["id_comunidad", "edad_min_meses", "edad_max_meses", "filtro_vacunacion"].includes(campo)) {
      setPrevisualizacion(null);
      setFirmaPrevisualizada("");
    }
    setError("");
  };

  const previsualizar = async () => {
    try {
      setPrevisualizando(true);
      setError("");
      setMensaje("");
      const filtros = construirFiltros(formulario);
      if (filtros.edad_min_meses !== null && filtros.edad_max_meses !== null && filtros.edad_min_meses > filtros.edad_max_meses) {
        setError("La edad mínima no puede ser mayor que la edad máxima.");
        return;
      }
      const response = await api.post("/campanas/previsualizar", filtros);
      setPrevisualizacion(response.data);
      setFirmaPrevisualizada(firmaFiltros(filtros));
    } catch (err) {
      console.error("Error previsualizando campaña:", err);
      setPrevisualizacion(null);
      setFirmaPrevisualizada("");
      setError(obtenerError(err, "No se pudo calcular la audiencia de la campaña."));
    } finally {
      setPrevisualizando(false);
    }
  };

  const validarFormulario = () => {
    if (!formulario.titulo.trim()) return "Escribe el título de la campaña.";
    if (!formulario.mensaje.trim()) return "Escribe el mensaje que recibirán los padres.";
    if (formulario.titulo.trim().length > 150) return "El título no debe superar 150 caracteres.";
    if (formulario.mensaje.trim().length > 3000) return "El mensaje no debe superar 3000 caracteres.";
    if (formulario.descripcion.trim().length > 2000) return "La descripción no debe superar 2000 caracteres.";
    if (formulario.fecha_programada) {
      const fecha = new Date(formulario.fecha_programada);
      if (Number.isNaN(fecha.getTime())) return "La fecha programada no es válida.";
      if (fecha.getTime() < Date.now() - 60000) return "La fecha programada no puede estar en el pasado.";
    }
    return "";
  };

  const solicitarConfirmacion = () => {
    const errorFormulario = validarFormulario();
    if (errorFormulario) {
      setError(errorFormulario);
      return;
    }
    if (!previsualizacionVigente) {
      setError("Primero debes previsualizar la audiencia con los filtros actuales.");
      return;
    }
    if (Number(previsualizacion?.resumen?.destinatarios_validos || 0) === 0) {
      setError("No hay destinatarios válidos. Ajusta los filtros o los contactos antes de crear la campaña.");
      return;
    }
    setError("");
    setConfirmacion(true);
  };

  const crearCampana = async () => {
    try {
      setCreando(true);
      setError("");
      setMensaje("");
      const filtros = construirFiltros(formulario);
      if (firmaFiltros(filtros) !== firmaPrevisualizada) {
        setConfirmacion(false);
        setPrevisualizacion(null);
        setError("Los filtros cambiaron. Vuelve a previsualizar antes de programar.");
        return;
      }
      const payload = {
        titulo: formulario.titulo.trim(),
        tipo: formulario.tipo,
        descripcion: formulario.descripcion.trim() || null,
        mensaje: formulario.mensaje.trim(),
        ...filtros,
        fecha_programada: formulario.fecha_programada
          ? new Date(formulario.fecha_programada).toISOString()
          : null,
      };
      const response = await api.post("/campanas", payload);
      const creada = response.data?.campana;
      setConfirmacion(false);
      setMensaje(response.data?.mensaje || "Campaña creada y notificaciones agregadas a la cola.");
      setFormulario((actual) => ({
        ...FORM_INICIAL,
        id_comunidad: actual.id_comunidad,
        edad_min_meses: actual.edad_min_meses,
        edad_max_meses: actual.edad_max_meses,
        filtro_vacunacion: actual.filtro_vacunacion,
      }));
      setPrevisualizacion(null);
      setFirmaPrevisualizada("");
      setPagina(1);
      await cargarCampanas(true);
      if (creada?.id_campana) {
        await abrirDetalle(creada.id_campana);
      }
    } catch (err) {
      console.error("Error creando campaña:", err);
      setConfirmacion(false);
      setError(obtenerError(err, "No se pudo crear la campaña."));
    } finally {
      setCreando(false);
    }
  };

  const abrirDetalle = async (id) => {
    try {
      setCargandoDetalle(true);
      setDetalle({ cargando: true });
      const response = await api.get(`/campanas/${id}`);
      setDetalle(response.data);
    } catch (err) {
      console.error("Error consultando detalle de campaña:", err);
      setError(obtenerError(err, "No se pudo consultar el detalle de la campaña."));
      setDetalle(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const aplicarBusqueda = (event) => {
    event.preventDefault();
    setPagina(1);
    setBusquedaAplicada(busqueda.trim());
  };

  const campanasFiltradas = useMemo(() => {
    const termino = busquedaAplicada.toLocaleLowerCase("es-GT");
    if (!termino) return campanas;
    return campanas.filter((campana) =>
      [campana.titulo, campana.tipo, campana.comunidad_nombre, campana.estado_actual]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase("es-GT").includes(termino))
    );
  }, [campanas, busquedaAplicada]);

  const resumenPagina = useMemo(() => ({
    total: campanas.length,
    enviadas: campanas.reduce((total, item) => total + Number(item.enviadas || 0), 0),
    pendientes: campanas.reduce((total, item) => total + Number(item.pendientes || 0), 0),
    errores: campanas.reduce((total, item) => total + Number(item.errores || 0), 0),
  }), [campanas]);

  const tipoLabel = (tipo) => TIPOS.find((item) => item.value === tipo)?.label || tipo || "—";

  return (
    <div className="campaigns-page">
      <div className="campaigns-header">
        <div>
          <div className="campaigns-heading">
            <Megaphone size={22} />
            <h1>Campañas comunitarias</h1>
          </div>
          <p>Organiza jornadas y envía avisos segmentados a los padres de familia.</p>
        </div>
        <button type="button" className="campaigns-btn campaigns-btn-secondary" onClick={() => { cargarCampanas(true); cargarComunidades(); }} disabled={actualizando || cargandoComunidades}>
          <RefreshCw size={15} className={actualizando ? "campaigns-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="campaigns-alert campaigns-alert-error" role="alert">
          <AlertCircle size={17} /><span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Cerrar"><X size={16} /></button>
        </div>
      )}
      {mensaje && (
        <div className="campaigns-alert campaigns-alert-success" role="status">
          <CheckCircle2 size={17} /><span>{mensaje}</span>
          <button type="button" onClick={() => setMensaje("")} aria-label="Cerrar"><X size={16} /></button>
        </div>
      )}

      <div className="campaigns-summary">
        <TarjetaResumen Icon={Megaphone} titulo="Campañas en esta página" valor={resumenPagina.total} detalle="Registros mostrados" />
        <TarjetaResumen Icon={CheckCircle2} titulo="Mensajes enviados" valor={resumenPagina.enviadas} detalle="Entregas registradas" variante="green" />
        <TarjetaResumen Icon={Clock3} titulo="Pendientes" valor={resumenPagina.pendientes} detalle="En cola de envío" variante="amber" />
        <TarjetaResumen Icon={AlertCircle} titulo="Con errores" valor={resumenPagina.errores} detalle="Requieren revisión" variante="red" />
      </div>

      <section className="campaigns-panel">
        <div className="campaigns-panel-heading">
          <div>
            <h2><Plus size={17} /> Preparar nueva campaña</h2>
            <p>Define el contenido y selecciona a quiénes llegará el mensaje.</p>
          </div>
          <span className="campaigns-secure-label"><ShieldCheck size={14} /> Revisión de destinatarios</span>
        </div>

        <div className="campaigns-form-grid">
          <label className="campaigns-field campaigns-field-wide">
            <span>Título de la campaña <b>*</b></span>
            <input maxLength={150} value={formulario.titulo} onChange={(e) => cambiarCampo("titulo", e.target.value)} placeholder="Ej. Jornada de vacunación de noviembre" />
          </label>

          <label className="campaigns-field">
            <span>Tipo de campaña <b>*</b></span>
            <select value={formulario.tipo} onChange={(e) => cambiarCampo("tipo", e.target.value)}>
              {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
            </select>
          </label>

          <label className="campaigns-field">
            <span>Comunidad</span>
            <select value={formulario.id_comunidad} onChange={(e) => cambiarCampo("id_comunidad", e.target.value)} disabled={cargandoComunidades}>
              <option value="">Todas las comunidades</option>
              {comunidades.map((comunidad) => (
                <option key={comunidad.id_comunidad} value={comunidad.id_comunidad}>{comunidad.nombre}</option>
              ))}
            </select>
          </label>

          <label className="campaigns-field">
            <span>Edad mínima (meses)</span>
            <input type="number" min="0" step="1" value={formulario.edad_min_meses} onChange={(e) => cambiarCampo("edad_min_meses", e.target.value)} placeholder="Sin mínimo" />
          </label>

          <label className="campaigns-field">
            <span>Edad máxima (meses)</span>
            <input type="number" min="0" step="1" value={formulario.edad_max_meses} onChange={(e) => cambiarCampo("edad_max_meses", e.target.value)} placeholder="Sin máximo" />
          </label>

          <label className="campaigns-field">
            <span>Estado de vacunación</span>
            <select value={formulario.filtro_vacunacion} onChange={(e) => cambiarCampo("filtro_vacunacion", e.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Vacunación pendiente</option>
              <option value="completa">Vacunación completa (criterio operativo)</option>
            </select>
          </label>

          <label className="campaigns-field">
            <span>Fecha y hora de envío</span>
            <input type="datetime-local" min={fechaMinimaLocal()} value={formulario.fecha_programada} onChange={(e) => cambiarCampo("fecha_programada", e.target.value)} />
            <small>Déjalo vacío para enviar en el siguiente ciclo del procesador.</small>
          </label>

          <label className="campaigns-field campaigns-field-wide">
            <span>Descripción interna</span>
            <input maxLength={2000} value={formulario.descripcion} onChange={(e) => cambiarCampo("descripcion", e.target.value)} placeholder="Información de referencia para el personal de salud (opcional)" />
          </label>

          <label className="campaigns-field campaigns-field-wide">
            <span>Mensaje para los padres <b>*</b></span>
            <textarea rows={4} maxLength={3000} value={formulario.mensaje} onChange={(e) => cambiarCampo("mensaje", e.target.value)} placeholder="Escribe la invitación, fecha, hora y lugar de la jornada..." />
            <small>{formulario.mensaje.length}/3000 caracteres. Evita incluir diagnósticos o información clínica individual.</small>
          </label>
        </div>

        <div className="campaigns-form-actions">
          <div className="campaigns-form-note"><Info size={15} /> Primero previsualiza la audiencia. No se enviará ningún mensaje durante esta revisión.</div>
          <button type="button" className="campaigns-btn campaigns-btn-primary" onClick={previsualizar} disabled={previsualizando || cargandoComunidades}>
            {previsualizando ? <LoaderCircle size={16} className="campaigns-spin" /> : <Search size={16} />}
            {previsualizando ? "Calculando audiencia..." : "Previsualizar destinatarios"}
          </button>
        </div>

        {previsualizacionVigente && (
          <div className="campaigns-preview">
            <div className="campaigns-preview-heading">
              <div>
                <span className="campaigns-preview-kicker">Resultado de segmentación</span>
                <h3>Audiencia de la campaña</h3>
              </div>
              <span className="campaigns-preview-valid"><CheckCircle2 size={14} /> Previsualización vigente</span>
            </div>
            <div className="campaigns-preview-grid">
              <div><span>Pacientes encontrados</span><strong>{previsualizacion.resumen?.pacientes_encontrados ?? 0}</strong></div>
              <div><span>Contactos principales</span><strong>{previsualizacion.resumen?.contactos_principales ?? 0}</strong></div>
              <div><span>Destinatarios válidos</span><strong>{previsualizacion.resumen?.destinatarios_validos ?? 0}</strong></div>
              <div><span>Sin contacto principal</span><strong>{previsualizacion.resumen?.sin_contacto_principal ?? 0}</strong></div>
              <div><span>Sin destinatario</span><strong>{previsualizacion.resumen?.sin_destinatario ?? 0}</strong></div>
              <div><span>Canal no soportado</span><strong>{previsualizacion.resumen?.canal_no_soportado ?? 0}</strong></div>
            </div>
            <div className="campaigns-preview-channels">
              <span><Mail size={15} /> Correo: <strong>{previsualizacion.resumen?.email ?? 0}</strong></span>
              <span><Send size={15} /> Telegram: <strong>{previsualizacion.resumen?.telegram ?? 0}</strong></span>
            </div>
            <p className="campaigns-vaccine-note"><Info size={14} /> {previsualizacion.criterio_vacunacion}</p>
            <div className="campaigns-preview-actions">
              <span>La creación agregará los mensajes a la cola de envíos automáticos.</span>
              <button type="button" className="campaigns-btn campaigns-btn-primary" onClick={solicitarConfirmacion} disabled={Number(previsualizacion.resumen?.destinatarios_validos || 0) === 0}>
                <CalendarClock size={16} /> Crear y programar campaña
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="campaigns-panel campaigns-history-panel">
        <div className="campaigns-panel-heading">
          <div>
            <h2><FileText size={17} /> Historial de campañas</h2>
            <p>Consulta el estado de cada campaña y el resultado por destinatario.</p>
          </div>
          <span className="campaigns-total-label">{Number(paginacion.total || 0).toLocaleString("es-GT")} campañas</span>
        </div>
        <form className="campaigns-toolbar" onSubmit={aplicarBusqueda}>
          <div className="campaigns-search">
            <Search size={15} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por título, tipo o comunidad..." />
            {busqueda && <button type="button" onClick={() => { setBusqueda(""); setBusquedaAplicada(""); setPagina(1); }} aria-label="Limpiar búsqueda"><X size={14} /></button>}
          </div>
          <button type="submit" className="campaigns-btn campaigns-btn-secondary"><Search size={15} /> Buscar</button>
        </form>

        {cargando ? (
          <div className="campaigns-empty"><LoaderCircle className="campaigns-spin" size={22} /> Cargando campañas...</div>
        ) : campanasFiltradas.length === 0 ? (
          <div className="campaigns-empty"><Megaphone size={25} /><strong>No hay campañas para mostrar</strong><span>Crea una campaña o cambia el término de búsqueda.</span></div>
        ) : (
          <div className="campaigns-table-wrap">
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Comunidad</th>
                  <th>Programación</th>
                  <th>Destinatarios</th>
                  <th>Resultado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campanasFiltradas.map((campana) => (
                  <tr key={campana.id_campana}>
                    <td>
                      <div className="campaign-title-cell">
                        <span className="campaign-title-icon"><Megaphone size={16} /></span>
                        <div><strong>{campana.titulo}</strong><small>{tipoLabel(campana.tipo)}</small></div>
                      </div>
                    </td>
                    <td>{campana.comunidad_nombre || "Todas las comunidades"}</td>
                    <td><span className="campaign-date-cell"><CalendarDays size={14} />{formatearFecha(campana.fecha_programada)}</span></td>
                    <td>{Number(campana.destinatarios_total || 0)}</td>
                    <td><span className="campaign-delivery-cell"><strong>{Number(campana.enviadas || 0)}</strong> enviadas <span>·</span> <strong>{Number(campana.pendientes || 0)}</strong> pendientes <span>·</span> <strong>{Number(campana.errores || 0)}</strong> errores</span></td>
                    <td><InsigniaEstado estado={campana.estado_actual || campana.estado} /></td>
                    <td><button type="button" className="campaigns-icon-btn" onClick={() => abrirDetalle(campana.id_campana)} title="Ver detalle"><Eye size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="campaigns-pagination">
          <span>{paginacion.total ? `Página ${pagina} de ${Math.max(1, paginacion.total_paginas || 1)}` : "Sin registros"}</span>
          <div>
            <button type="button" className="campaigns-icon-btn" disabled={pagina <= 1 || cargando} onClick={() => setPagina((actual) => Math.max(1, actual - 1))} aria-label="Página anterior"><ChevronLeft size={17} /></button>
            <button type="button" className="campaigns-icon-btn" disabled={pagina >= (paginacion.total_paginas || 1) || cargando} onClick={() => setPagina((actual) => actual + 1)} aria-label="Página siguiente"><ChevronRight size={17} /></button>
          </div>
        </div>
      </section>

      {confirmacion && (
        <div className="campaigns-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !creando) setConfirmacion(false); }}>
          <section className="campaigns-modal campaigns-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-confirm-title">
            <div className="campaigns-modal-header">
              <div><span className="campaigns-modal-icon"><CalendarClock size={19} /></span><div><h3 id="campaign-confirm-title">Confirmar campaña</h3><p>Verifica antes de agregar los mensajes a la cola.</p></div></div>
              <button type="button" className="campaigns-icon-btn" onClick={() => setConfirmacion(false)} disabled={creando} aria-label="Cerrar"><X size={17} /></button>
            </div>
            <div className="campaigns-confirm-body">
              <strong>{formulario.titulo}</strong>
              <div className="campaigns-confirm-count"><Users size={19} /><span><b>{previsualizacion?.resumen?.destinatarios_validos || 0}</b> destinatarios válidos</span></div>
              <p>Canales: {previsualizacion?.resumen?.telegram || 0} por Telegram y {previsualizacion?.resumen?.email || 0} por correo.</p>
              <p>Programación: {formulario.fecha_programada ? formatearFecha(new Date(formulario.fecha_programada).toISOString()) : "En el siguiente ciclo automático"}.</p>
              <div className="campaigns-confirm-warning"><AlertCircle size={16} /> Al confirmar, la campaña se guardará y sus mensajes entrarán en la cola. El procesador los enviará cuando corresponda.</div>
            </div>
            <div className="campaigns-modal-actions">
              <button type="button" className="campaigns-btn campaigns-btn-secondary" onClick={() => setConfirmacion(false)} disabled={creando}>Volver</button>
              <button type="button" className="campaigns-btn campaigns-btn-primary" onClick={crearCampana} disabled={creando}>
                {creando ? <LoaderCircle size={16} className="campaigns-spin" /> : <CheckCircle2 size={16} />}
                {creando ? "Creando..." : "Confirmar y programar"}
              </button>
            </div>
          </section>
        </div>
      )}

      {detalle && (
        <div className="campaigns-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetalle(null); }}>
          <section className="campaigns-modal campaigns-detail-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-detail-title">
            {cargandoDetalle || detalle.cargando ? (
              <div className="campaigns-empty"><LoaderCircle className="campaigns-spin" size={23} /> Cargando detalle...</div>
            ) : (
              <>
                <div className="campaigns-modal-header">
                  <div><span className="campaigns-modal-icon"><Megaphone size={19} /></span><div><h3 id="campaign-detail-title">{detalle.campana?.titulo || "Detalle de campaña"}</h3><p>{tipoLabel(detalle.campana?.tipo)} · {detalle.campana?.comunidad_nombre || "Todas las comunidades"}</p></div></div>
                  <button type="button" className="campaigns-icon-btn" onClick={() => setDetalle(null)} aria-label="Cerrar"><X size={17} /></button>
                </div>
                <div className="campaigns-detail-summary">
                  <div><span>Destinatarios</span><strong>{detalle.campana?.destinatarios_total ?? 0}</strong></div>
                  <div><span>Enviadas</span><strong>{detalle.campana?.enviadas ?? 0}</strong></div>
                  <div><span>Pendientes</span><strong>{detalle.campana?.pendientes ?? 0}</strong></div>
                  <div><span>Errores</span><strong>{detalle.campana?.errores ?? 0}</strong></div>
                </div>
                <div className="campaigns-detail-message"><span>Mensaje de la campaña</span><p>{detalle.campana?.mensaje || "—"}</p></div>
                <div className="campaigns-detail-recipients">
                  <h4>Destinatarios y estado de envío</h4>
                  {(detalle.destinatarios || []).length === 0 ? (
                    <div className="campaigns-empty compact">No hay destinatarios registrados.</div>
                  ) : (
                    <div className="campaigns-recipient-list">
                      {detalle.destinatarios.map((destinatario) => {
                        const estadoConfig = ESTADOS_DESTINATARIO[destinatario.estado] || ESTADOS_DESTINATARIO.pendiente;
                        return (
                          <div className="campaigns-recipient-row" key={destinatario.id_notificacion}>
                            <div className="campaigns-recipient-person"><span><UserRound size={15} /></span><div><strong>{destinatario.padre}</strong><small>{destinatario.destinatario}</small></div></div>
                            <div className="campaigns-recipient-meta"><InsigniaCanal canal={destinatario.canal} /><span className={`campaign-status ${estadoConfig.className}`}>{estadoConfig.label}</span><small>{destinatario.intentos || 0} intentos</small></div>
                            {destinatario.error_detalle && <p className="campaigns-recipient-error">{destinatario.error_detalle}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="campaigns-modal-actions"><button type="button" className="campaigns-btn campaigns-btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button></div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
