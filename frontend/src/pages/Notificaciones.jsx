import { useCallback, useEffect, useState } from "react";
import {
  BellRing,
  Search,
  RefreshCw,
  Mail,
  Send,
  Clock3,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  UserRound,
  Baby,
  Hash,
} from "lucide-react";

import api from "../services/api";

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendientes" },
  { value: "procesando", label: "En proceso" },
  { value: "enviada", label: "Enviadas" },
  { value: "error", label: "Con error" },
];

const CANALES = [
  { value: "", label: "Todos los canales" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Correo electrónico" },
];

const ESTADO_CONFIG = {
  pendiente: { label: "Pendiente", className: "pending", Icon: Clock3 },
  procesando: { label: "En proceso", className: "processing", Icon: LoaderCircle },
  enviada: { label: "Enviada", className: "sent", Icon: CheckCircle2 },
  error: { label: "Error", className: "error", Icon: AlertCircle },
};

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(date);
}

function obtenerError(error, respaldo) {
  return error.response?.data?.mensaje || error.message || respaldo;
}

function TarjetaEstadistica({ titulo, valor, detalle, variant, Icon }) {
  return (
    <article className="notifications-stat-card">
      <div className={`notifications-stat-icon ${variant || ""}`}>
        <Icon size={20} />
      </div>
      <div className="notifications-stat-copy">
        <span>{titulo}</span>
        <strong>{Number(valor || 0).toLocaleString("es-GT")}</strong>
        <small>{detalle}</small>
      </div>
    </article>
  );
}

function InsigniaEstado({ estado }) {
  const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente;
  const Icon = config.Icon;

  return (
    <span className={`notifications-status ${config.className}`}>
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function InsigniaCanal({ canal }) {
  const esTelegram = canal === "telegram";
  const Icon = esTelegram ? Send : Mail;

  return (
    <span className={`notifications-channel ${esTelegram ? "telegram" : "email"}`}>
      <Icon size={14} />
      {esTelegram ? "Telegram" : "Correo"}
    </span>
  );
}

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    pendientes: 0,
    procesando: 0,
    enviadas: 0,
    errores: 0,
    telegram: 0,
    email: 0,
  });

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [estado, setEstado] = useState("");
  const [canal, setCanal] = useState("");
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(10);
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    limite: 10,
    total: 0,
    total_paginas: 0,
  });

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarEstadisticas = useCallback(async () => {
    const response = await api.get("/notificaciones/estadisticas");
    setEstadisticas(response.data?.estadisticas || {});
  }, []);

  const cargarNotificaciones = useCallback(async (opciones = {}) => {
    const filtros = {
      pagina: opciones.pagina ?? pagina,
      limite,
      estado: opciones.estado ?? estado,
      canal: opciones.canal ?? canal,
      busqueda: opciones.busqueda ?? busquedaAplicada,
    };

    try {
      setError("");
      const response = await api.get("/notificaciones", { params: filtros });
      const datos = response.data?.data;

      setNotificaciones(Array.isArray(datos) ? datos : []);
      setPaginacion(response.data?.paginacion || {
        pagina: filtros.pagina,
        limite,
        total: 0,
        total_paginas: 0,
      });
    } catch (err) {
      console.error("Error al cargar notificaciones:", err);
      setError(obtenerError(err, "No se pudo cargar el historial de notificaciones."));
      setNotificaciones([]);
    }
  }, [pagina, limite, estado, canal, busquedaAplicada]);

  const cargarTodo = useCallback(async (silencioso = false) => {
    if (silencioso) setActualizando(true);
    else setCargando(true);

    try {
      await Promise.all([
        cargarNotificaciones(),
        cargarEstadisticas(),
      ]);
    } catch (err) {
      console.error("Error al actualizar el módulo:", err);
      setError(obtenerError(err, "No se pudieron actualizar los datos."));
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [cargarNotificaciones, cargarEstadisticas]);

  useEffect(() => {
    cargarTodo(false);
  }, [cargarTodo]);

  const aplicarBusqueda = (event) => {
    event.preventDefault();
    setPagina(1);
    setBusquedaAplicada(busqueda.trim());
  };

  const cambiarEstado = (event) => {
    setEstado(event.target.value);
    setPagina(1);
  };

  const cambiarCanal = (event) => {
    setCanal(event.target.value);
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setBusquedaAplicada("");
    setEstado("");
    setCanal("");
    setPagina(1);
  };

  const abrirDetalle = async (id) => {
    try {
      setCargandoDetalle(true);
      setDetalle(null);
      const response = await api.get(`/notificaciones/${id}`);
      setDetalle(response.data?.data || null);
    } catch (err) {
      setError(obtenerError(err, "No se pudo cargar el detalle de la notificación."));
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => setDetalle(null);

  const totalPaginas = Number(paginacion.total_paginas || 0);
  const desde = paginacion.total === 0 ? 0 : (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, Number(paginacion.total || 0));

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <div className="notifications-heading">
            <BellRing size={23} />
            <h1>Historial de notificaciones</h1>
          </div>
          <p>Consulta los avisos generados y el resultado de sus envíos por correo y Telegram.</p>
        </div>

        <button
          type="button"
          className="notifications-btn notifications-btn-outline"
          onClick={() => cargarTodo(true)}
          disabled={actualizando || cargando}
        >
          <RefreshCw size={16} className={actualizando ? "notifications-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="notifications-alert notifications-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Cerrar aviso">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="notifications-stats">
        <TarjetaEstadistica
          titulo="Total de avisos"
          valor={estadisticas.total}
          detalle="Registros acumulados"
          Icon={BellRing}
          variant=""
        />
        <TarjetaEstadistica
          titulo="Enviadas"
          valor={estadisticas.enviadas}
          detalle="Entregadas al servicio"
          Icon={CheckCircle2}
          variant="green"
        />
        <TarjetaEstadistica
          titulo="Pendientes"
          valor={Number(estadisticas.pendientes || 0) + Number(estadisticas.procesando || 0)}
          detalle={`${estadisticas.procesando || 0} en proceso`}
          Icon={Clock3}
          variant="amber"
        />
        <TarjetaEstadistica
          titulo="Con error"
          valor={estadisticas.errores}
          detalle="Requieren revisión"
          Icon={AlertCircle}
          variant="red"
        />
      </section>

      <section className="notifications-channel-summary">
        <div className="notifications-channel-summary-title">
          <span>Canales utilizados</span>
          <small>Según los registros guardados</small>
        </div>
        <div className="notifications-channel-counts">
          <div><Send size={16} /><span>Telegram</span><strong>{estadisticas.telegram || 0}</strong></div>
          <div><Mail size={16} /><span>Correo electrónico</span><strong>{estadisticas.email || 0}</strong></div>
        </div>
      </section>

      <section className="notifications-panel">
        <div className="notifications-panel-heading">
          <div>
            <h2>Registro de envíos</h2>
            <p>Busca y filtra las notificaciones registradas en SCCVI.</p>
          </div>
          <span className="notifications-total-label">
            {Number(paginacion.total || 0).toLocaleString("es-GT")} registros
          </span>
        </div>

        <form className="notifications-toolbar" onSubmit={aplicarBusqueda}>
          <label className="notifications-search">
            <Search size={17} />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por padre, paciente, correo o destinatario..."
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
          </label>

          <select value={estado} onChange={cambiarEstado} aria-label="Filtrar por estado">
            {ESTADOS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <select value={canal} onChange={cambiarCanal} aria-label="Filtrar por canal">
            {CANALES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <button type="submit" className="notifications-btn notifications-btn-primary">
            <Search size={15} /> Buscar
          </button>

          <button type="button" className="notifications-btn notifications-btn-outline" onClick={limpiarFiltros}>
            Limpiar
          </button>
        </form>

        {cargando ? (
          <div className="notifications-state">
            <LoaderCircle size={25} className="notifications-spin" />
            <span>Cargando historial...</span>
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="notifications-empty">
            <div><BellRing size={25} /></div>
            <strong>No hay notificaciones para mostrar</strong>
            <span>Prueba cambiando los filtros o espera a que se genere un nuevo aviso.</span>
          </div>
        ) : (
          <>
            <div className="notifications-table-wrap">
              <table className="notifications-table">
                <thead>
                  <tr>
                    <th>Destinatario</th>
                    <th>Paciente</th>
                    <th>Canal</th>
                    <th>Estado</th>
                    <th>Intentos</th>
                    <th>Fecha de envío</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {notificaciones.map((item) => (
                    <tr key={item.id_notificacion}>
                      <td>
                        <div className="notifications-person">
                          <div className="notifications-avatar"><UserRound size={17} /></div>
                          <div>
                            <strong>{item.padre || "Padre sin nombre"}</strong>
                            <span>{item.destinatario || "Sin destinatario"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="notifications-patient">
                          <Baby size={15} />
                          <span>{item.paciente || "—"}</span>
                        </div>
                      </td>
                      <td><InsigniaCanal canal={item.canal} /></td>
                      <td><InsigniaEstado estado={item.estado} /></td>
                      <td><span className="notifications-attempts">{item.intentos || 0} / {item.max_intentos || 5}</span></td>
                      <td className="notifications-date">{formatearFecha(item.enviado_en || item.creado_en)}</td>
                      <td>
                        <button
                          type="button"
                          className="notifications-icon-btn"
                          onClick={() => abrirDetalle(item.id_notificacion)}
                          title="Ver detalle"
                          aria-label={`Ver notificación ${item.id_notificacion}`}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="notifications-pagination">
              <span>Mostrando {desde}–{hasta} de {Number(paginacion.total || 0)}</span>
              <div>
                <button
                  type="button"
                  className="notifications-page-btn"
                  onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                  disabled={pagina <= 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={17} />
                </button>
                <span>Página {pagina} de {Math.max(totalPaginas, 1)}</span>
                <button
                  type="button"
                  className="notifications-page-btn"
                  onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                  disabled={pagina >= totalPaginas || totalPaginas === 0}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {(detalle || cargandoDetalle) && (
        <div className="notifications-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) cerrarDetalle();
        }}>
          <section className="notifications-modal" role="dialog" aria-modal="true" aria-labelledby="notification-detail-title">
            <div className="notifications-modal-header">
              <div>
                <span>DETALLE DEL REGISTRO</span>
                <h2 id="notification-detail-title">Notificación #{detalle?.id_notificacion || "..."}</h2>
              </div>
              <button type="button" className="notifications-icon-btn" onClick={cerrarDetalle} aria-label="Cerrar detalle">
                <X size={18} />
              </button>
            </div>

            {cargandoDetalle ? (
              <div className="notifications-state"><LoaderCircle size={24} className="notifications-spin" /> Cargando detalle...</div>
            ) : detalle && (
              <div className="notifications-detail-content">
                <div className="notifications-detail-badges">
                  <InsigniaEstado estado={detalle.estado} />
                  <InsigniaCanal canal={detalle.canal} />
                </div>

                <div className="notifications-detail-grid">
                  <div><span>Padre / encargado</span><strong>{detalle.padre || "—"}</strong></div>
                  <div><span>Paciente</span><strong>{detalle.paciente || "—"}</strong></div>
                  <div><span>Destinatario</span><strong>{detalle.destinatario || "—"}</strong></div>
                  <div><span>Intentos</span><strong>{detalle.intentos || 0} de {detalle.max_intentos || 5}</strong></div>
                  <div><span>Fecha de creación</span><strong>{formatearFecha(detalle.creado_en)}</strong></div>
                  <div><span>Fecha de envío</span><strong>{formatearFecha(detalle.enviado_en)}</strong></div>
                </div>

                <div className="notifications-detail-message">
                  <span>Asunto</span>
                  <strong>{detalle.asunto || "Sin asunto"}</strong>
                  <span>Mensaje</span>
                  <p>{detalle.mensaje || "Sin contenido"}</p>
                </div>

                {detalle.error_detalle && (
                  <div className="notifications-error-detail">
                    <AlertCircle size={16} />
                    <div><strong>Detalle del error</strong><p>{detalle.error_detalle}</p></div>
                  </div>
                )}

                <div className="notifications-detail-footer">
                  <span><Hash size={14} /> Alerta #{detalle.id_alerta}</span>
                  <span><CalendarClock size={14} /> Programada: {formatearFecha(detalle.fecha_programada)}</span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
