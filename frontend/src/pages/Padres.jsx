
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserRound,
  UserPlus,
  Search,
  Plus,
  Pencil,
  RefreshCw,
  X,
  Phone,
  Mail,
  MapPin,
  Baby,
  Link2,
  Unlink,
  Star,
  CheckCircle2,
  CircleOff,
  MessageCircle,
  Copy,
  ShieldCheck,
} from "lucide-react";

import api from "../services/api";

const formularioInicial = {
  nombres: "",
  apellidos: "",
  dpi: "",
  telefono: "",
  correo: "",
  id_comunidad: "",
  canal_preferido: "email",
};

function obtenerArreglo(data, propiedad) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[propiedad]) ? data[propiedad] : [];
}

export default function Padres() {
  const [padres, setPadres] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [pacientes, setPacientes] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todas");
  const [comunidadFiltro, setComunidadFiltro] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState({
    ...formularioInicial,
  });

  // Estado del modal de asociaciones
  const [modalAsociaciones, setModalAsociaciones] = useState(false);
  const [padreDetalle, setPadreDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [pacienteSeleccionado, setPacienteSeleccionado] = useState("");
  const [parentesco, setParentesco] = useState("Madre");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [guardandoAsociacion, setGuardandoAsociacion] = useState(false);

  // Vinculación de Telegram
  const [modalTelegram, setModalTelegram] = useState(false);
  const [padreTelegram, setPadreTelegram] = useState(null);
  const [estadoTelegram, setEstadoTelegram] = useState(null);
  const [enlaceTelegram, setEnlaceTelegram] = useState(null);
  const [cargandoTelegram, setCargandoTelegram] = useState(false);
  const [generandoTelegram, setGenerandoTelegram] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [telegramMensaje, setTelegramMensaje] = useState("");
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);

  // ============================================
  // CARGAR CATALOGOS
  // ============================================

  const cargarCatalogos = async () => {
    try {
      const [comunidadesResponse, pacientesResponse] =
        await Promise.all([
          api.get("/comunidades", {
            params: { estado: "activa" },
          }),
          api.get("/pacientes"),
        ]);

      setComunidades(
        obtenerArreglo(comunidadesResponse.data, "comunidades")
      );

      const pacientesData = obtenerArreglo(
        pacientesResponse.data,
        "pacientes"
      );

      setPacientes(
        pacientesData.filter(
          (paciente) => paciente.estado !== "inactivo"
        )
      );
    } catch (err) {
      console.error("Error al cargar catálogos:", err);
      setError("No se pudieron cargar comunidades o pacientes.");
    }
  };

  // ============================================
  // CARGAR PADRES
  // ============================================

  const cargarPadres = async (filtros = {}) => {
    try {
      setCargando(true);
      setError("");

      const response = await api.get("/padres", {
        params: {
          buscar: filtros.buscar ?? busqueda,
          estado: filtros.estado ?? estado,
          comunidad: filtros.comunidad ?? comunidadFiltro,
        },
      });

      setPadres(obtenerArreglo(response.data, "padres"));
    } catch (err) {
      console.error("Error al cargar padres:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar los padres de familia."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
    cargarPadres({
      buscar: "",
      estado: "todas",
      comunidad: "",
    });
  }, []);

  // ============================================
  // RESUMEN
  // ============================================

  const resumen = useMemo(() => ({
    total: padres.length,

    activos: padres.filter(
      (padre) => padre.estado === "activo"
    ).length,

    ninos: padres.reduce(
      (total, padre) => total + Number(padre.total_ninos || 0),
      0
    ),

    conContacto: padres.filter(
      (padre) => padre.telefono || padre.correo
    ).length,
  }), [padres]);

  // ============================================
  // BUSQUEDA Y FILTROS
  // ============================================

  const buscarPadres = (e) => {
    e.preventDefault();

    cargarPadres({
      buscar: busqueda,
      estado,
      comunidad: comunidadFiltro,
    });
  };

  const cambiarEstadoFiltro = (e) => {
    const nuevoEstado = e.target.value;
    setEstado(nuevoEstado);

    cargarPadres({
      buscar: busqueda,
      estado: nuevoEstado,
      comunidad: comunidadFiltro,
    });
  };

  const cambiarComunidadFiltro = (e) => {
    const nuevaComunidad = e.target.value;
    setComunidadFiltro(nuevaComunidad);

    cargarPadres({
      buscar: busqueda,
      estado,
      comunidad: nuevaComunidad,
    });
  };

  // ============================================
  // FORMULARIO DE PADRES
  // ============================================

  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    setFormulario((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario({ ...formularioInicial });
    setError("");
    setMensaje("");
    setModal(true);
  };

  const abrirEdicion = (padre) => {
    setEditando(padre);

    setFormulario({
      nombres: padre.nombres || "",
      apellidos: padre.apellidos || "",
      dpi: padre.dpi || "",
      telefono: padre.telefono || "",
      correo: padre.correo || "",
      id_comunidad: String(padre.id_comunidad || ""),
      canal_preferido: padre.canal_preferido || "email",
    });

    setError("");
    setMensaje("");
    setModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setModal(false);
    setEditando(null);
    setFormulario({ ...formularioInicial });
  };

  // ============================================
  // GUARDAR PADRE
  // ============================================

  const guardarPadre = async (e) => {
    e.preventDefault();

    if (!formulario.nombres.trim() ||
        !formulario.apellidos.trim()) {
      setError("Los nombres y apellidos son obligatorios.");
      return;
    }

    if (!formulario.id_comunidad) {
      setError("Selecciona una comunidad.");
      return;
    }

    const dpi = formulario.dpi.trim().replace(/\D/g, "");

    if (dpi && dpi.length !== 13) {
      setError("El DPI debe contener exactamente 13 dígitos.");
      return;
    }

    const datos = {
      nombres: formulario.nombres.trim(),
      apellidos: formulario.apellidos.trim(),
      dpi: dpi || "",
      telefono: formulario.telefono.trim(),
      correo: formulario.correo.trim(),
      id_comunidad: Number(formulario.id_comunidad),
      canal_preferido: formulario.canal_preferido,
    };

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (editando) {
        await api.put(
          `/padres/${editando.id_padre}`,
          datos
        );

        setMensaje("Padre de familia actualizado correctamente.");
      } else {
        await api.post("/padres", datos);

        setMensaje("Padre de familia registrado correctamente.");
      }

      setModal(false);
      setEditando(null);
      setFormulario({ ...formularioInicial });

      await cargarPadres();
    } catch (err) {
      console.error("Error al guardar padre:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudo guardar el padre de familia."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ============================================
  // ACTIVAR Y DESACTIVAR PADRE
  // ============================================

  const cambiarEstadoPadre = async (padre) => {
    const activo = padre.estado === "activo";
    const accion = activo ? "desactivar" : "reactivar";

    const confirmar = window.confirm(
      `¿Deseas ${accion} a ${padre.nombres} ${padre.apellidos}?`
    );

    if (!confirmar) return;

    try {
      setError("");
      setMensaje("");

      if (activo) {
        await api.patch(`/padres/${padre.id_padre}/desactivar`);
      } else {
        await api.patch(`/padres/${padre.id_padre}/activar`);
      }

      setMensaje(
        activo
          ? "Padre desactivado correctamente."
          : "Padre reactivado correctamente."
      );

      await cargarPadres();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo actualizar el estado del padre."
      );
    }
  };

  // ============================================
  // ABRIR DETALLE Y ASOCIACIONES
  // ============================================

  const cargarDetallePadre = async (idPadre) => {
    try {
      setCargandoDetalle(true);

      const response = await api.get(`/padres/${idPadre}`);

      setPadreDetalle({
        ...response.data,
        pacientes: obtenerArreglo(response.data.pacientes, "pacientes"),
      });
    } catch (err) {
      console.error("Error al consultar padre:", err);
      setError(
        err.response?.data?.mensaje ||
          "No se pudo consultar la información del padre."
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  const abrirAsociaciones = async (padre) => {
    setPadreDetalle(null);
    setPacienteSeleccionado("");
    setParentesco("Madre");
    setEsPrincipal(false);
    setError("");

    setModalAsociaciones(true);

    await cargarDetallePadre(padre.id_padre);
  };

  const cerrarAsociaciones = () => {
    if (guardandoAsociacion) return;

    setModalAsociaciones(false);
    setPadreDetalle(null);
    setPacienteSeleccionado("");
  };

  // ============================================
  // PACIENTES DISPONIBLES
  // ============================================

  const pacientesDisponibles = useMemo(() => {
    const asociados = new Set(
      (padreDetalle?.pacientes || []).map(
        (paciente) => Number(paciente.id_paciente)
      )
    );

    return pacientes.filter(
      (paciente) => !asociados.has(Number(paciente.id_paciente))
    );
  }, [pacientes, padreDetalle]);

  // ============================================
  // ASOCIAR PACIENTE
  // ============================================

  const asociarPaciente = async (e) => {
    e.preventDefault();

    if (!padreDetalle || !pacienteSeleccionado) {
      setError("Selecciona un paciente para asociarlo.");
      return;
    }

    try {
      setGuardandoAsociacion(true);
      setError("");

      await api.post(
        `/padres/${padreDetalle.id_padre}/pacientes`,
        {
          id_paciente: Number(pacienteSeleccionado),
          parentesco,
          es_contacto_principal: esPrincipal,
        }
      );

      setPacienteSeleccionado("");
      setParentesco("Madre");
      setEsPrincipal(false);

      await cargarDetallePadre(padreDetalle.id_padre);
      await cargarPadres();
    } catch (err) {
      console.error("Error al asociar paciente:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudo asociar el paciente."
      );
    } finally {
      setGuardandoAsociacion(false);
    }
  };

  // ============================================
  // DESASOCIAR PACIENTE
  // ============================================

  const desasociarPaciente = async (paciente) => {
    const confirmar = window.confirm(
      `¿Deseas quitar a ${paciente.nombres} ${paciente.apellidos} de este padre?`
    );

    if (!confirmar || !padreDetalle) return;

    try {
      setError("");

      await api.delete(
        `/padres/${padreDetalle.id_padre}/pacientes/${paciente.id_paciente}`
      );

      await cargarDetallePadre(padreDetalle.id_padre);
      await cargarPadres();

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo quitar la asociación."
      );
    }
  };

  // ============================================
  // DESIGNAR CONTACTO PRINCIPAL
  // ============================================

  const marcarPrincipal = async (paciente) => {
    if (!padreDetalle) return;

    try {
      setError("");

      await api.patch(
        `/padres/${padreDetalle.id_padre}/pacientes/${paciente.id_paciente}/contacto-principal`
      );

      await cargarDetallePadre(padreDetalle.id_padre);

      setMensaje("Contacto principal actualizado correctamente.");
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo actualizar el contacto principal."
      );
    }
  };

  // ============================================
  // VINCULACIÓN DE TELEGRAM
  // ============================================

  const cargarEstadoTelegram = async (idPadre) => {
    try {
      setCargandoTelegram(true);
      setTelegramError("");
      const response = await api.get(`/padres/${idPadre}/telegram/estado`);
      setEstadoTelegram(response.data.padre || null);
    } catch (err) {
      setTelegramError(
        err.response?.data?.mensaje ||
          "No se pudo consultar el estado de Telegram."
      );
    } finally {
      setCargandoTelegram(false);
    }
  };

  const abrirVinculacionTelegram = async (padre) => {
    setPadreTelegram(padre);
    setEstadoTelegram(null);
    setEnlaceTelegram(null);
    setTelegramError("");
    setTelegramMensaje("");
    setEnlaceCopiado(false);
    setModalTelegram(true);
    await cargarEstadoTelegram(padre.id_padre);
  };

  const generarEnlaceTelegram = async () => {
    if (!padreTelegram) return;

    try {
      setGenerandoTelegram(true);
      setTelegramError("");
      setTelegramMensaje("");
      setEnlaceCopiado(false);

      const response = await api.post(
        `/padres/${padreTelegram.id_padre}/telegram/vincular`
      );

      setEnlaceTelegram(response.data.vinculacion || null);
      setTelegramMensaje(response.data.mensaje || "Enlace generado correctamente.");
      await cargarEstadoTelegram(padreTelegram.id_padre);
    } catch (err) {
      setTelegramError(
        err.response?.data?.mensaje ||
          "No se pudo generar el enlace de Telegram."
      );
    } finally {
      setGenerandoTelegram(false);
    }
  };

  const copiarEnlaceTelegram = async () => {
    if (!enlaceTelegram?.enlace) return;

    try {
      await navigator.clipboard.writeText(enlaceTelegram.enlace);
      setEnlaceCopiado(true);
      setTelegramMensaje("Enlace copiado. Compártelo únicamente con el padre correspondiente.");
    } catch {
      setTelegramError("El navegador no permitió copiar el enlace. Selecciónalo y cópialo manualmente.");
    }
  };

  const actualizarEstadoTelegram = async () => {
    if (!padreTelegram) return;
    await cargarEstadoTelegram(padreTelegram.id_padre);
    await cargarPadres();
  };

  const desvincularCuentaTelegram = async () => {
    if (!padreTelegram || !estadoTelegram?.vinculado) return;

    const confirmar = window.confirm(
      `¿Deseas desvincular la cuenta de Telegram de ${estadoTelegram.nombre}? Dejará de recibir notificaciones por Telegram.`
    );
    if (!confirmar) return;

    try {
      setCargandoTelegram(true);
      setTelegramError("");
      const response = await api.delete(
        `/padres/${padreTelegram.id_padre}/telegram/vincular`
      );
      setTelegramMensaje(response.data.mensaje || "Cuenta desvinculada.");
      setEnlaceTelegram(null);
      await cargarEstadoTelegram(padreTelegram.id_padre);
      await cargarPadres();
    } catch (err) {
      setTelegramError(
        err.response?.data?.mensaje ||
          "No se pudo desvincular la cuenta."
      );
    } finally {
      setCargandoTelegram(false);
    }
  };

  const cerrarModalTelegram = () => {
    if (generandoTelegram || cargandoTelegram) return;
    setModalTelegram(false);
    setPadreTelegram(null);
    setEstadoTelegram(null);
    setEnlaceTelegram(null);
    setTelegramError("");
    setTelegramMensaje("");
  };

  // ============================================
  // FORMATEAR CANAL
  // ============================================

  const nombreCanal = (canal) => {
    const canales = {
      email: "Correo electrónico",
      telegram: "Telegram",
      whatsapp: "WhatsApp",
    };

    return canales[canal] || canal || "No definido";
  };

  // ============================================
  // RENDERIZADO
  // ============================================

  return (
    <div className="parents-page">

      {/* ENCABEZADO */}

      <div className="parents-header">
        <div>
          <div className="parents-title">
            <Users size={24} />
            <h1>Padres de familia</h1>
          </div>

          <p>
            Administra los encargados y responsables de los niños registrados.
          </p>
        </div>

        <div className="parents-header-actions">
          <button
            type="button"
            className="parents-btn parents-btn-outline"
            onClick={() => {
              cargarCatalogos();
              cargarPadres();
            }}
            disabled={cargando}
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>

          <button
            type="button"
            className="parents-btn parents-btn-primary"
            onClick={abrirNuevo}
          >
            <Plus size={18} />
            Nuevo padre
          </button>
        </div>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="parents-alert parents-alert-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Cerrar mensaje"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {mensaje && (
        <div className="parents-alert parents-alert-success">
          <CheckCircle2 size={17} />
          <span>{mensaje}</span>

          <button
            type="button"
            onClick={() => setMensaje("")}
            aria-label="Cerrar mensaje"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* RESUMEN */}

      <div className="parents-stats">
        <div className="parents-stat-card">
          <div className="parents-stat-icon">
            <Users size={21} />
          </div>
          <div>
            <span>Padres encontrados</span>
            <strong>{resumen.total}</strong>
          </div>
        </div>

        <div className="parents-stat-card">
          <div className="parents-stat-icon parents-stat-green">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <span>Padres activos</span>
            <strong>{resumen.activos}</strong>
          </div>
        </div>

        <div className="parents-stat-card">
          <div className="parents-stat-icon parents-stat-blue">
            <Baby size={21} />
          </div>
          <div>
            <span>Asociaciones con niños</span>
            <strong>{resumen.ninos}</strong>
          </div>
        </div>

        <div className="parents-stat-card">
          <div className="parents-stat-icon parents-stat-purple">
            <MessageCircle size={21} />
          </div>
          <div>
            <span>Con datos de contacto</span>
            <strong>{resumen.conContacto}</strong>
          </div>
        </div>
      </div>

      {/* FILTROS */}

      <div className="parents-toolbar">
        <form className="parents-search" onSubmit={buscarPadres}>
          <Search size={18} />

          <input
            type="search"
            placeholder="Buscar por nombre, DPI, teléfono o comunidad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {busqueda && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                cargarPadres({ buscar: "", estado, comunidad: comunidadFiltro });
              }}
              aria-label="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}

          <button type="submit" className="parents-search-submit">
            Buscar
          </button>
        </form>

        <div className="parents-filters">
          <label htmlFor="padres-estado">Estado</label>

          <select
            id="padres-estado"
            value={estado}
            onChange={cambiarEstadoFiltro}
          >
            <option value="todas">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <label htmlFor="padres-comunidad">Comunidad</label>

          <select
            id="padres-comunidad"
            value={comunidadFiltro}
            onChange={cambiarComunidadFiltro}
          >
            <option value="">Todas</option>

            {comunidades.map((comunidad) => (
              <option
                key={comunidad.id_comunidad}
                value={comunidad.id_comunidad}
              >
                {comunidad.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA */}

      <div className="parents-table-container">
        <div className="parents-table-heading">
          <div>
            <h2>Listado de padres de familia</h2>
            <p>{padres.length} registros encontrados</p>
          </div>

          <Users size={21} />
        </div>

        {cargando ? (
          <div className="parents-empty">
            <RefreshCw size={25} className="parents-spin" />
            <strong>Cargando padres...</strong>
          </div>
        ) : padres.length === 0 ? (
          <div className="parents-empty">
            <UserRound size={32} />
            <strong>No hay padres registrados</strong>
            <p>Registra un padre o encargado para comenzar.</p>

            <button
              type="button"
              className="parents-btn parents-btn-primary"
              onClick={abrirNuevo}
            >
              <Plus size={16} />
              Registrar padre
            </button>
          </div>
        ) : (
          <div className="parents-table-scroll">
            <table className="parents-table">
              <thead>
                <tr>
                  <th>Padre / encargado</th>
                  <th>DPI</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Comunidad</th>
                  <th>Canal</th>
                  <th>Telegram</th>
                  <th>Niños</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {padres.map((padre) => {
                  const activo = padre.estado === "activo";

                  return (
                    <tr key={padre.id_padre}>
                      <td>
                        <div className="parents-name-cell">
                          <div className="parents-row-avatar">
                            <UserRound size={17} />
                          </div>

                          <div>
                            <strong>
                              {padre.nombres} {padre.apellidos}
                            </strong>
                            <span>ID #{padre.id_padre}</span>
                          </div>
                        </div>
                      </td>

                      <td>{padre.dpi || "—"}</td>

                      <td>
                        {padre.telefono ? (
                          <span className="parents-contact">
                            <Phone size={13} />
                            {padre.telefono}
                          </span>
                        ) : "—"}
                      </td>

                      <td className="parents-email">
                        {padre.correo || "—"}
                      </td>

                      <td>
                        <span className="parents-community">
                          <MapPin size={13} />
                          {padre.comunidad_nombre || "—"}
                        </span>
                      </td>

                      <td>{nombreCanal(padre.canal_preferido)}</td>

                      <td>
                        <span className={`parents-telegram-status ${padre.telegram_chat_id ? "linked" : "unlinked"}`}>
                          <span className="parents-telegram-dot" />
                          {padre.telegram_chat_id ? "Vinculado" : "Sin vincular"}
                        </span>
                      </td>

                      <td>
                        <span className="parents-count">
                          <Baby size={14} />
                          {Number(padre.total_ninos || 0)}
                        </span>
                      </td>

                      <td>
                        <span className={`parents-status ${activo ? "active" : "inactive"}`}>
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <div className="parents-actions">
                          <button
                            type="button"
                            className="parents-action-btn"
                            onClick={() => abrirAsociaciones(padre)}
                            title="Administrar niños"
                          >
                            <Link2 size={16} />
                          </button>

                          <button
                            type="button"
                            className={`parents-action-btn ${padre.telegram_chat_id ? "parents-telegram-action-linked" : ""}`}
                            onClick={() => abrirVinculacionTelegram(padre)}
                            title={padre.telegram_chat_id ? "Administrar vínculo Telegram" : "Vincular Telegram"}
                            disabled={!activo}
                          >
                            <MessageCircle size={16} />
                          </button>

                          <button
                            type="button"
                            className="parents-action-btn"
                            onClick={() => abrirEdicion(padre)}
                            title="Editar padre"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className={`parents-action-btn ${activo ? "action-danger" : "action-success"}`}
                            onClick={() => cambiarEstadoPadre(padre)}
                            title={activo ? "Desactivar" : "Reactivar"}
                          >
                            {activo
                              ? <CircleOff size={16} />
                              : <CheckCircle2 size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================
          MODAL REGISTRO / EDICIÓN
      ====================================== */}

      {modal && (
        <div className="parents-modal-overlay" onClick={cerrarModal}>
          <div
            className="parents-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="parents-modal-header">
              <div>
                <div className="parents-modal-icon">
                  <UserRound size={22} />
                </div>

                <h2>
                  {editando ? "Editar padre de familia" : "Registrar padre de familia"}
                </h2>

                <p>Ingresa los datos del padre, madre o encargado.</p>
              </div>

              <button
                type="button"
                className="parents-action-btn"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={guardarPadre}>
              <div className="parents-form-grid">

                <div className="parents-field">
                  <label htmlFor="padre-nombres">Nombres *</label>
                  <input
                    id="padre-nombres"
                    name="nombres"
                    value={formulario.nombres}
                    onChange={cambiarCampo}
                    maxLength={100}
                    placeholder="Ej. Carlos Alberto"
                    required
                  />
                </div>

                <div className="parents-field">
                  <label htmlFor="padre-apellidos">Apellidos *</label>
                  <input
                    id="padre-apellidos"
                    name="apellidos"
                    value={formulario.apellidos}
                    onChange={cambiarCampo}
                    maxLength={100}
                    placeholder="Ej. Pérez López"
                    required
                  />
                </div>

                <div className="parents-field">
                  <label htmlFor="padre-dpi">DPI</label>
                  <input
                    id="padre-dpi"
                    name="dpi"
                    value={formulario.dpi}
                    onChange={cambiarCampo}
                    maxLength={20}
                    placeholder="13 dígitos"
                  />
                  <small>Opcional. Si se proporciona, debe tener 13 dígitos.</small>
                </div>

                <div className="parents-field">
                  <label htmlFor="padre-telefono">Teléfono</label>
                  <input
                    id="padre-telefono"
                    name="telefono"
                    value={formulario.telefono}
                    onChange={cambiarCampo}
                    maxLength={25}
                    placeholder="Ej. 55555555"
                  />
                </div>

                <div className="parents-field parents-field-full">
                  <label htmlFor="padre-correo">Correo electrónico</label>
                  <input
                    id="padre-correo"
                    type="email"
                    name="correo"
                    value={formulario.correo}
                    onChange={cambiarCampo}
                    maxLength={150}
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div className="parents-field">
                  <label htmlFor="padre-comunidad">Comunidad *</label>
                  <select
                    id="padre-comunidad"
                    name="id_comunidad"
                    value={formulario.id_comunidad}
                    onChange={cambiarCampo}
                    required
                  >
                    <option value="">Selecciona una comunidad</option>

                    {comunidades.map((comunidad) => (
                      <option
                        key={comunidad.id_comunidad}
                        value={comunidad.id_comunidad}
                      >
                        {comunidad.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="parents-field">
                  <label htmlFor="padre-canal">Canal preferido</label>
                  <select
                    id="padre-canal"
                    name="canal_preferido"
                    value={formulario.canal_preferido}
                    onChange={cambiarCampo}
                  >
                    <option value="email">Correo electrónico</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>

              </div>

              {comunidades.length === 0 && (
                <div className="parents-inline-warning">
                  Primero debes registrar una comunidad activa.
                </div>
              )}

              <div className="parents-modal-footer">
                <button
                  type="button"
                  className="parents-btn parents-btn-outline"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="parents-btn parents-btn-primary"
                  disabled={guardando || comunidades.length === 0}
                >
                  {guardando ? (
                    <>
                      <RefreshCw size={16} className="parents-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      {editando ? "Guardar cambios" : "Registrar padre"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================
          MODAL DE ASOCIACION DE NIÑOS
      ====================================== */}

      {modalAsociaciones && (
        <div
          className="parents-modal-overlay"
          onClick={cerrarAsociaciones}
        >
          <div
            className="parents-modal parents-associations-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="parents-modal-header">
              <div>
                <div className="parents-modal-icon">
                  <Baby size={22} />
                </div>

                <h2>Niños asociados</h2>

                <p>
                  {padreDetalle
                    ? `${padreDetalle.nombres} ${padreDetalle.apellidos}`
                    : "Cargando información..."}
                </p>
              </div>

              <button
                type="button"
                className="parents-action-btn"
                onClick={cerrarAsociaciones}
                disabled={guardandoAsociacion}
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </div>

            {cargandoDetalle ? (
              <div className="parents-empty">
                <RefreshCw size={23} className="parents-spin" />
                <strong>Cargando asociaciones...</strong>
              </div>
            ) : padreDetalle ? (
              <>
                <div className="parents-association-list">
                  {(padreDetalle.pacientes || []).length === 0 ? (
                    <div className="parents-empty parents-empty-compact">
                      <Baby size={27} />
                      <strong>No hay niños asociados</strong>
                      <p>Agrega un paciente mediante el formulario siguiente.</p>
                    </div>
                  ) : (
                    padreDetalle.pacientes.map((paciente) => (
                      <div
                        className="parents-association-card"
                        key={paciente.id_paciente}
                      >
                        <div className="parents-association-avatar">
                          <UserRound size={19} />
                        </div>

                        <div className="parents-association-info">
                          <strong>
                            {paciente.nombres} {paciente.apellidos}
                          </strong>

                          <span>
                            {paciente.parentesco} · ID #{paciente.id_paciente}
                          </span>

                          {paciente.es_contacto_principal && (
                            <span className="parents-primary-label">
                              <Star size={13} />
                              Contacto principal
                            </span>
                          )}
                        </div>

                        <div className="parents-association-actions">
                          {!paciente.es_contacto_principal && (
                            <button
                              type="button"
                              className="parents-action-btn"
                              onClick={() => marcarPrincipal(paciente)}
                              title="Designar contacto principal"
                              disabled={padreDetalle.estado !== "activo"}
                            >
                              <Star size={16} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="parents-action-btn action-danger"
                            onClick={() => desasociarPaciente(paciente)}
                            title="Quitar asociación"
                          >
                            <Unlink size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="parents-association-form-container">
                  <h3>
                    <UserPlus size={17} />
                    Asociar un niño
                  </h3>

                  {padreDetalle.estado !== "activo" ? (
                    <div className="parents-inline-warning">
                      Reactiva al padre para poder agregar asociaciones.
                    </div>
                  ) : pacientesDisponibles.length === 0 ? (
                    <div className="parents-inline-warning">
                      No hay otros pacientes activos disponibles para asociar.
                    </div>
                  ) : (
                    <form
                      className="parents-association-form"
                      onSubmit={asociarPaciente}
                    >
                      <div className="parents-field">
                        <label htmlFor="asociar-paciente">Paciente</label>

                        <select
                          id="asociar-paciente"
                          value={pacienteSeleccionado}
                          onChange={(e) => setPacienteSeleccionado(e.target.value)}
                          required
                        >
                          <option value="">Selecciona un niño</option>

                          {pacientesDisponibles.map((paciente) => (
                            <option
                              key={paciente.id_paciente}
                              value={paciente.id_paciente}
                            >
                              {paciente.nombres} {paciente.apellidos}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="parents-field">
                        <label htmlFor="asociar-parentesco">Parentesco</label>

                        <select
                          id="asociar-parentesco"
                          value={parentesco}
                          onChange={(e) => setParentesco(e.target.value)}
                        >
                          <option value="Madre">Madre</option>
                          <option value="Padre">Padre</option>
                          <option value="Abuela">Abuela</option>
                          <option value="Abuelo">Abuelo</option>
                          <option value="Tutor">Tutor</option>
                          <option value="Encargado">Encargado</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>

                      <label className="parents-primary-checkbox">
                        <input
                          type="checkbox"
                          checked={esPrincipal}
                          onChange={(e) => setEsPrincipal(e.target.checked)}
                        />
                        Designar como contacto principal
                      </label>

                      <button
                        type="submit"
                        className="parents-btn parents-btn-primary"
                        disabled={guardandoAsociacion}
                      >
                        {guardandoAsociacion ? (
                          <RefreshCw size={16} className="parents-spin" />
                        ) : (
                          <Link2 size={16} />
                        )}
                        Asociar paciente
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="parents-empty">
                No se pudo cargar la información del padre.
              </div>
            )}

            <div className="parents-modal-footer">
              <button
                type="button"
                className="parents-btn parents-btn-outline"
                onClick={cerrarAsociaciones}
                disabled={guardandoAsociacion}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================
          MODAL DE VINCULACIÓN TELEGRAM
      ====================================== */}
      {modalTelegram && (
        <div className="parents-modal-overlay" onClick={cerrarModalTelegram}>
          <div
            className="parents-modal parents-telegram-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="parents-modal-header">
              <div>
                <div className="parents-modal-icon parents-telegram-icon">
                  <MessageCircle size={22} />
                </div>
                <h2>Vincular Telegram</h2>
                <p>
                  {padreTelegram
                    ? `${padreTelegram.nombres} ${padreTelegram.apellidos}`
                    : "Padre de familia"}
                </p>
              </div>
              <button
                type="button"
                className="parents-action-btn"
                onClick={cerrarModalTelegram}
                disabled={generandoTelegram || cargandoTelegram}
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </div>

            {telegramError && (
              <div className="parents-alert parents-alert-error">
                <span>{telegramError}</span>
                <button type="button" onClick={() => setTelegramError("")} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </div>
            )}

            {telegramMensaje && (
              <div className="parents-alert parents-alert-success">
                <CheckCircle2 size={17} />
                <span>{telegramMensaje}</span>
                <button type="button" onClick={() => setTelegramMensaje("")} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </div>
            )}

            {cargandoTelegram && !estadoTelegram ? (
              <div className="parents-empty">
                <RefreshCw size={23} className="parents-spin" />
                <strong>Consultando vinculación...</strong>
              </div>
            ) : estadoTelegram ? (
              <div className="parents-telegram-content">
                <div className={`parents-telegram-status-card ${estadoTelegram.vinculado ? "is-linked" : "is-unlinked"}`}>
                  <div className="parents-telegram-status-icon">
                    {estadoTelegram.vinculado ? <ShieldCheck size={23} /> : <MessageCircle size={23} />}
                  </div>
                  <div>
                    <strong>{estadoTelegram.vinculado ? "Cuenta de Telegram vinculada" : "Telegram sin vincular"}</strong>
                    <span>
                      {estadoTelegram.vinculado
                        ? (estadoTelegram.telegram_username
                            ? `@${estadoTelegram.telegram_username}`
                            : "La cuenta ya está asociada al registro.")
                        : "Genera un enlace personal para el padre o tutor."}
                    </span>
                  </div>
                </div>

                {estadoTelegram.vinculado ? (
                  <>
                    {estadoTelegram.vinculado_en && (
                      <p className="parents-telegram-meta">
                        Vinculado el {new Date(estadoTelegram.vinculado_en).toLocaleString("es-GT")}
                      </p>
                    )}
                    <div className="parents-telegram-note">
                      Esta cuenta recibirá las notificaciones cuando el canal preferido del padre sea Telegram.
                    </div>
                    <div className="parents-modal-footer">
                      <button
                        type="button"
                        className="parents-btn parents-btn-outline"
                        onClick={actualizarEstadoTelegram}
                        disabled={cargandoTelegram}
                      >
                        <RefreshCw size={16} /> Actualizar estado
                      </button>
                      <button
                        type="button"
                        className="parents-btn parents-btn-danger"
                        onClick={desvincularCuentaTelegram}
                        disabled={cargandoTelegram}
                      >
                        <Unlink size={16} /> Desvincular
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="parents-telegram-steps">
                      <strong>Cómo vincular la cuenta</strong>
                      <ol>
                        <li>Genera un enlace personal desde este panel.</li>
                        <li>Compártelo únicamente con el padre registrado.</li>
                        <li>El padre abre el enlace desde Telegram y presiona Iniciar.</li>
                        <li>Actualiza el estado para confirmar la vinculación.</li>
                      </ol>
                    </div>

                    {enlaceTelegram?.enlace && (
                      <div className="parents-telegram-link-box">
                        <label>Enlace personal de vinculación</label>
                        <div className="parents-telegram-link-text">
                          {enlaceTelegram.enlace}
                        </div>
                        <div className="parents-telegram-link-actions">
                          <button type="button" className="parents-btn parents-btn-outline" onClick={copiarEnlaceTelegram}>
                            <Copy size={16} /> {enlaceCopiado ? "Copiado" : "Copiar enlace"}
                          </button>
                          <span>Vence: {new Date(enlaceTelegram.expira_en).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    )}

                    <div className="parents-telegram-note">
                      El enlace es de un solo uso y vence en 10 minutos. No lo publiques en grupos ni lo compartas con otro padre.
                    </div>
                    <div className="parents-modal-footer">
                      <button
                        type="button"
                        className="parents-btn parents-btn-outline"
                        onClick={actualizarEstadoTelegram}
                        disabled={cargandoTelegram}
                      >
                        <RefreshCw size={16} /> Actualizar estado
                      </button>
                      <button
                        type="button"
                        className="parents-btn parents-btn-primary"
                        onClick={generarEnlaceTelegram}
                        disabled={generandoTelegram || cargandoTelegram || estadoTelegram.estado !== "activo"}
                      >
                        {generandoTelegram ? <RefreshCw size={16} className="parents-spin" /> : <Link2 size={16} />}
                        {enlaceTelegram ? "Generar otro enlace" : "Generar enlace"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="parents-empty">No se pudo consultar el estado de Telegram.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}