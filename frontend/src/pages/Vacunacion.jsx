import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Syringe,
  CalendarDays,
  RefreshCw,
  Plus,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Search,
  RotateCcw,
  X,
} from "lucide-react";
import api from "../services/api";

function fechaLocalISO() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function fechaCorta(valor) {
  if (!valor) return "No registrada";
  const texto = String(valor).slice(0, 10);
  const [anio, mes, dia] = texto.split("-").map(Number);
  if (!anio || !mes || !dia) return "No registrada";
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function nombrePaciente(paciente) {
  return `${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim();
}

export default function Vacunacion() {
  const [pestana, setPestana] = useState("registro");
  const [vacunas, setVacunas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [dosisPendientes, setDosisPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarNuevaVacuna, setMostrarNuevaVacuna] = useState(false);

  const [formulario, setFormulario] = useState({
    id_paciente: "",
    id_vacuna: "",
    dosis: "1",
    fecha_aplicacion: fechaLocalISO(),
    lote: "",
    proxima_dosis: "",
    observaciones: "",
  });

  const [formVacuna, setFormVacuna] = useState({
    nombre: "",
    descripcion: "",
    edad_recomendada: "",
    numero_dosis: "1",
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setMensaje(null);

    try {
      const [resVacunas, resPacientes, resDosis] = await Promise.all([
        api.get("/vacunacion/vacunas"),
        api.get("/pacientes", { params: { estado: "activo" } }),
        api.get("/vacunacion/proximas-dosis"),
      ]);

      const listaVacunas = Array.isArray(resVacunas.data) ? resVacunas.data : [];
      const listaPacientes = Array.isArray(resPacientes.data) ? resPacientes.data : [];
      const listaDosis = Array.isArray(resDosis.data) ? resDosis.data : [];

      setVacunas(listaVacunas);
      setPacientes(listaPacientes);
      setDosisPendientes(listaDosis);

      setFormulario((actual) => ({
        ...actual,
        id_paciente: actual.id_paciente || (listaPacientes[0]?.id_paciente ? String(listaPacientes[0].id_paciente) : ""),
        id_vacuna: actual.id_vacuna || (listaVacunas.find((v) => v.estado)?.id_vacuna ? String(listaVacunas.find((v) => v.estado).id_vacuna) : ""),
      }));
    } catch (error) {
      console.error("Error cargando módulo de vacunación:", error);
      setMensaje({
        tipo: "error",
        texto: error.response?.data?.mensaje || "No se pudo cargar la información de vacunación.",
      });
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarHistorial = useCallback(async (idPaciente) => {
    if (!idPaciente) {
      setHistorial([]);
      return;
    }
    try {
      const respuesta = await api.get(`/vacunacion/paciente/${idPaciente}`);
      setHistorial(Array.isArray(respuesta.data) ? respuesta.data : []);
    } catch (error) {
      console.error("Error cargando historial de vacunación:", error);
      setHistorial([]);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    cargarHistorial(formulario.id_paciente);
  }, [formulario.id_paciente, cargarHistorial]);

  const vacunasActivas = useMemo(
    () => vacunas.filter((vacuna) => vacuna.estado === true),
    [vacunas]
  );

  const vacunaSeleccionada = vacunas.find(
    (vacuna) => String(vacuna.id_vacuna) === String(formulario.id_vacuna)
  );

  const totalAtrasadas = dosisPendientes.filter((item) => item.estado_dosis === "atrasada").length;
  const totalProximas = dosisPendientes.filter((item) => item.estado_dosis === "proxima").length;

  const vacunasFiltradas = vacunas.filter((vacuna) =>
    `${vacuna.nombre} ${vacuna.edad_recomendada || ""}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const actualizarFormulario = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const registrarVacunacion = async (event) => {
    event.preventDefault();
    setMensaje(null);

    if (!formulario.id_paciente || !formulario.id_vacuna || !formulario.fecha_aplicacion) {
      setMensaje({ tipo: "error", texto: "Selecciona el paciente, la vacuna y la fecha de aplicación." });
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        ...formulario,
        id_paciente: Number(formulario.id_paciente),
        id_vacuna: Number(formulario.id_vacuna),
        dosis: Number(formulario.dosis),
        proxima_dosis: formulario.proxima_dosis || null,
        lote: formulario.lote.trim() || null,
        observaciones: formulario.observaciones.trim() || null,
      };

      const respuesta = await api.post("/vacunacion", payload);
      setMensaje({ tipo: "exito", texto: respuesta.data?.mensaje || "Vacunación registrada correctamente." });
      setFormulario((actual) => ({
        ...actual,
        dosis: "1",
        fecha_aplicacion: fechaLocalISO(),
        lote: "",
        proxima_dosis: "",
        observaciones: "",
      }));
      await cargarDatos();
      await cargarHistorial(formulario.id_paciente);
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error.response?.data?.mensaje || "No se pudo registrar la vacunación.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const crearVacuna = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setMensaje(null);

    try {
      const respuesta = await api.post("/vacunacion/vacunas", {
        ...formVacuna,
        numero_dosis: Number(formVacuna.numero_dosis),
      });
      setMensaje({ tipo: "exito", texto: respuesta.data?.mensaje || "Vacuna agregada correctamente." });
      setFormVacuna({ nombre: "", descripcion: "", edad_recomendada: "", numero_dosis: "1" });
      setMostrarNuevaVacuna(false);
      await cargarDatos();
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.mensaje || "No se pudo crear la vacuna. Verifica tus permisos." });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoVacuna = async (vacuna) => {
    const accion = vacuna.estado ? "desactivar" : "activar";
    const confirmado = window.confirm(
      `¿Deseas ${accion} la vacuna ${vacuna.nombre}? El historial de aplicaciones se conservará.`
    );
    if (!confirmado) return;

    setMensaje(null);
    try {
      const respuesta = await api.patch(`/vacunacion/vacunas/${vacuna.id_vacuna}/${accion}`);
      setMensaje({ tipo: "exito", texto: respuesta.data?.mensaje || "Estado del catálogo actualizado." });
      await cargarDatos();
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.mensaje || "No se pudo actualizar el estado. Se requiere permiso de administrador." });
    }
  };

  return (
    <div className="vac-page">
      <div className="vac-heading">
        <div>
          <div className="vac-eyebrow">CONTROL DE INMUNIZACIÓN</div>
          <h2>Gestión de vacunación</h2>
          <p>Administra el catálogo, registra aplicaciones y revisa las próximas dosis.</p>
        </div>
        <button className="vac-button vac-button-secondary" onClick={cargarDatos} disabled={cargando}>
          <RefreshCw size={16} className={cargando ? "vac-spin" : ""} /> Actualizar
        </button>
      </div>

      {mensaje && (
        <div className={`vac-message ${mensaje.tipo}`} role="status">
          {mensaje.tipo === "exito" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{mensaje.texto}</span>
          <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar mensaje"><X size={16} /></button>
        </div>
      )}

      <div className="vac-stats">
        <div className="vac-stat-card">
          <span className="vac-stat-icon teal"><Syringe size={19} /></span>
          <div><small>Vacunas activas</small><strong>{vacunasActivas.length}</strong></div>
        </div>
        <div className="vac-stat-card">
          <span className="vac-stat-icon orange"><Clock3 size={19} /></span>
          <div><small>Dosis próximas</small><strong>{totalProximas}</strong></div>
        </div>
        <div className="vac-stat-card">
          <span className="vac-stat-icon red"><AlertTriangle size={19} /></span>
          <div><small>Dosis atrasadas</small><strong>{totalAtrasadas}</strong></div>
        </div>
        <div className="vac-stat-card">
          <span className="vac-stat-icon blue"><ClipboardList size={19} /></span>
          <div><small>Pacientes activos</small><strong>{pacientes.length}</strong></div>
        </div>
      </div>

      <div className="vac-tabs" role="tablist" aria-label="Secciones de vacunación">
        <button className={pestana === "registro" ? "active" : ""} onClick={() => setPestana("registro")}>
          <Plus size={16} /> Registrar aplicación
        </button>
        <button className={pestana === "pendientes" ? "active" : ""} onClick={() => setPestana("pendientes")}>
          <CalendarDays size={16} /> Próximas y atrasadas
          {dosisPendientes.length > 0 && <span className="vac-tab-count">{dosisPendientes.length}</span>}
        </button>
        <button className={pestana === "catalogo" ? "active" : ""} onClick={() => setPestana("catalogo")}>
          <Syringe size={16} /> Catálogo de vacunas
        </button>
      </div>

      {cargando ? (
        <div className="vac-empty"><RefreshCw size={20} className="vac-spin" /> Cargando información...</div>
      ) : (
        <>
          {pestana === "registro" && (
            <div className="vac-two-columns">
              <section className="vac-panel">
                <div className="vac-panel-title">
                  <div><h3>Registrar vacuna aplicada</h3><p>Guarda la dosis administrada al paciente.</p></div>
                  <span className="vac-title-icon"><Syringe size={19} /></span>
                </div>

                <form className="vac-form" onSubmit={registrarVacunacion}>
                  <label>Paciente
                    <select value={formulario.id_paciente} onChange={(e) => actualizarFormulario("id_paciente", e.target.value)} required>
                      <option value="">Selecciona un paciente</option>
                      {pacientes.map((paciente) => (
                        <option key={paciente.id_paciente} value={paciente.id_paciente}>
                          {nombrePaciente(paciente)} · ID {paciente.id_paciente}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>Vacuna
                    <select value={formulario.id_vacuna} onChange={(e) => actualizarFormulario("id_vacuna", e.target.value)} required>
                      <option value="">Selecciona una vacuna</option>
                      {vacunasActivas.map((vacuna) => (
                        <option key={vacuna.id_vacuna} value={vacuna.id_vacuna}>{vacuna.nombre}</option>
                      ))}
                    </select>
                  </label>

                  <div className="vac-form-row">
                    <label>Dosis
                      <input
                        type="number"
                        min="1"
                        max={vacunaSeleccionada?.numero_dosis || undefined}
                        step="1"
                        value={formulario.dosis}
                        onChange={(e) => actualizarFormulario("dosis", e.target.value)}
                        required
                      />
                      {vacunaSeleccionada && <small>Máximo configurado: {vacunaSeleccionada.numero_dosis}</small>}
                    </label>
                    <label>Fecha de aplicación
                      <input type="date" max={fechaLocalISO()} value={formulario.fecha_aplicacion} onChange={(e) => actualizarFormulario("fecha_aplicacion", e.target.value)} required />
                    </label>
                  </div>

                  <div className="vac-form-row">
                    <label>Lote
                      <input type="text" maxLength="100" value={formulario.lote} onChange={(e) => actualizarFormulario("lote", e.target.value)} placeholder="Número de lote" />
                    </label>
                    <label>Próxima dosis
                      <input type="date" min={formulario.fecha_aplicacion || undefined} value={formulario.proxima_dosis} onChange={(e) => actualizarFormulario("proxima_dosis", e.target.value)} />
                    </label>
                  </div>

                  <label>Observaciones
                    <textarea rows="3" maxLength="2000" value={formulario.observaciones} onChange={(e) => actualizarFormulario("observaciones", e.target.value)} placeholder="Observaciones opcionales" />
                  </label>

                  <button className="vac-button vac-button-primary" type="submit" disabled={guardando || pacientes.length === 0 || vacunasActivas.length === 0}>
                    <Plus size={17} /> {guardando ? "Guardando..." : "Registrar vacunación"}
                  </button>
                </form>
                {pacientes.length === 0 && <p className="vac-help">No hay pacientes activos disponibles.</p>}
                {vacunasActivas.length === 0 && <p className="vac-help">No hay vacunas activas en el catálogo.</p>}
              </section>

              <section className="vac-panel">
                <div className="vac-panel-title">
                  <div><h3>Historial del paciente</h3><p>Aplicaciones registradas para el paciente seleccionado.</p></div>
                  <span className="vac-title-icon"><ClipboardList size={19} /></span>
                </div>
                {!formulario.id_paciente ? (
                  <div className="vac-empty">Selecciona un paciente para consultar su historial.</div>
                ) : historial.length === 0 ? (
                  <div className="vac-empty">Este paciente todavía no tiene vacunas registradas.</div>
                ) : (
                  <div className="vac-history-list">
                    {historial.map((item) => (
                      <article className="vac-history-item" key={item.id_vacunacion}>
                        <div className="vac-history-top"><strong>{item.vacuna || "Vacuna"}</strong><span>{fechaCorta(item.fecha_aplicacion)}</span></div>
                        <div className="vac-history-meta">
                          <span>Dosis: {item.dosis}</span>
                          <span>Lote: {item.lote || "—"}</span>
                          <span>Próxima: {fechaCorta(item.proxima_dosis)}</span>
                        </div>
                        {item.observaciones && <p>{item.observaciones}</p>}
                        {item.vacuna_activa === false && <small className="vac-muted">Vacuna desactivada en catálogo; se conserva el registro histórico.</small>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {pestana === "pendientes" && (
            <section className="vac-panel">
              <div className="vac-panel-title">
                <div><h3>Seguimiento de próximas dosis</h3><p>Incluye las fechas futuras y las dosis cuyo vencimiento ya pasó.</p></div>
                <span className="vac-title-icon"><CalendarDays size={19} /></span>
              </div>
              {dosisPendientes.length === 0 ? (
                <div className="vac-empty">No hay próximas dosis ni dosis atrasadas registradas.</div>
              ) : (
                <div className="vac-table-wrap">
                  <table className="vac-table">
                    <thead><tr><th>Paciente</th><th>Vacuna</th><th>Última dosis aplicada</th><th>Fecha programada</th><th>Estado</th><th>Seguimiento</th></tr></thead>
                    <tbody>
                      {dosisPendientes.map((item) => (
                        <tr key={item.id_vacunacion}>
                          <td><strong>{nombrePaciente(item)}</strong><small>ID {item.id_paciente}</small></td>
                          <td>{item.vacuna}<small>Dosis registrada: {item.dosis}</small></td>
                          <td>{fechaCorta(item.fecha_aplicacion)}</td>
                          <td>{fechaCorta(item.proxima_dosis)}</td>
                          <td><span className={`vac-status ${item.estado_dosis === "atrasada" ? "overdue" : "upcoming"}`}>{item.estado_dosis === "atrasada" ? "Atrasada" : "Próxima"}</span></td>
                          <td>{item.estado_dosis === "atrasada" ? `${Math.abs(Number(item.dias_restantes))} días de atraso` : `${Number(item.dias_restantes)} días restantes`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {pestana === "catalogo" && (
            <section className="vac-panel">
              <div className="vac-panel-title">
                <div><h3>Catálogo de vacunas</h3><p>Consulta y administra las vacunas disponibles y sus esquemas de dosis.</p></div>
                <button className="vac-button vac-button-primary" onClick={() => setMostrarNuevaVacuna((v) => !v)}>
                  {mostrarNuevaVacuna ? <X size={16} /> : <Plus size={16} />}
                  {mostrarNuevaVacuna ? "Cerrar" : "Nueva vacuna"}
                </button>
              </div>

              {mostrarNuevaVacuna && (
                <form className="vac-catalog-form" onSubmit={crearVacuna}>
                  <label>Nombre<input value={formVacuna.nombre} maxLength="100" onChange={(e) => setFormVacuna((v) => ({ ...v, nombre: e.target.value }))} required /></label>
                  <label>Edad recomendada<input value={formVacuna.edad_recomendada} onChange={(e) => setFormVacuna((v) => ({ ...v, edad_recomendada: e.target.value }))} placeholder="Ej. 2 meses" /></label>
                  <label>Número de dosis<input type="number" min="1" step="1" value={formVacuna.numero_dosis} onChange={(e) => setFormVacuna((v) => ({ ...v, numero_dosis: e.target.value }))} required /></label>
                  <label className="vac-catalog-description">Descripción<textarea rows="2" value={formVacuna.descripcion} onChange={(e) => setFormVacuna((v) => ({ ...v, descripcion: e.target.value }))} /></label>
                  <button type="submit" className="vac-button vac-button-primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar vacuna"}</button>
                </form>
              )}

              <div className="vac-search-row">
                <div className="vac-search"><Search size={17} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar vacuna o edad recomendada..." /></div>
                <span className="vac-muted">{vacunasFiltradas.length} vacunas</span>
              </div>

              <div className="vac-table-wrap">
                <table className="vac-table">
                  <thead><tr><th>Vacuna</th><th>Edad recomendada</th><th>Número de dosis</th><th>Estado</th><th>Acción</th></tr></thead>
                  <tbody>
                    {vacunasFiltradas.map((vacuna) => (
                      <tr key={vacuna.id_vacuna}>
                        <td><strong>{vacuna.nombre}</strong>{vacuna.descripcion && <small>{vacuna.descripcion}</small>}</td>
                        <td>{vacuna.edad_recomendada || "—"}</td>
                        <td>{vacuna.numero_dosis}</td>
                        <td><span className={`vac-status ${vacuna.estado ? "active" : "inactive"}`}>{vacuna.estado ? "Activa" : "Desactivada"}</span></td>
                        <td><button className="vac-action-button" onClick={() => cambiarEstadoVacuna(vacuna)} title={vacuna.estado ? "Desactivar vacuna" : "Reactivar vacuna"}>{vacuna.estado ? <X size={16} /> : <RotateCcw size={16} />}{vacuna.estado ? "Desactivar" : "Reactivar"}</button></td>
                      </tr>
                    ))}
                    {vacunasFiltradas.length === 0 && <tr><td colSpan="5" className="vac-table-empty">No se encontraron vacunas.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="vac-help">La desactivación no elimina las aplicaciones históricas. Las acciones de administración del catálogo requieren rol administrador; el servidor valida los permisos.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
