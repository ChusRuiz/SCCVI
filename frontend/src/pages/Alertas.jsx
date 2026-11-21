
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Syringe,
  UserRound,
  X,
} from "lucide-react";

import api from "../services/api";

const TIPOS = {
  crecimiento_bajo: "Crecimiento bajo",
  crecimiento_alto: "Crecimiento elevado",
  control_atrasado: "Control atrasado",
  vacuna_pendiente: "Vacuna próxima",
  vacuna_atrasada: "Vacuna atrasada",
};

const formatearFecha = (valor) => {
  if (!valor) return "—";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) return "—";

  return fecha.toLocaleString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const nombreEstado = (estado) => {
  const nombres = {
    pendiente: "Pendiente",
    revisada: "Revisada",
    resuelta: "Resuelta",
    descartada: "Descartada",
  };

  return nombres[estado] || estado;
};

const nombrePrioridad = (prioridad) => {
  return prioridad === "critica" ? "Crítica" : "Preventiva";
};

const iconoTipo = (tipo) => {
  if (tipo?.startsWith("vacuna")) {
    return Syringe;
  }

  if (tipo === "control_atrasado") {
    return CalendarClock;
  }

  return Activity;
};

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);

  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    pendientes: 0,
    revisadas: 0,
    resueltas: 0,
    descartadas: 0,
    preventivas: 0,
    criticas: 0,
  });

  const [paginacion, setPaginacion] = useState({
    total: 0,
    pagina: 1,
    limite: 20,
    total_paginas: 0,
  });

  const [filtros, setFiltros] = useState({
    buscar: "",
    estado: "todas",
    prioridad: "todas",
    tipo: "todos",
  });

  const [pagina, setPagina] = useState(1);

  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [accionando, setAccionando] = useState(null);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);

  // ==========================================
  // PARAMETROS DE FILTROS
  // ==========================================

  const obtenerParametros = () => {
    const params = {
      pagina,
      limite: 20,
    };

    if (filtros.buscar.trim()) {
      params.buscar = filtros.buscar.trim();
    }

    if (filtros.estado !== "todas") {
      params.estado = filtros.estado;
    }

    if (filtros.prioridad !== "todas") {
      params.prioridad = filtros.prioridad;
    }

    if (filtros.tipo !== "todos") {
      params.tipo = filtros.tipo;
    }

    return params;
  };

  // ==========================================
  // CARGAR ALERTAS Y ESTADISTICAS
  // ==========================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const params = {
        pagina,
        limite: 20,
      };

      if (filtros.buscar.trim()) {
        params.buscar = filtros.buscar.trim();
      }

      if (filtros.estado !== "todas") {
        params.estado = filtros.estado;
      }

      if (filtros.prioridad !== "todas") {
        params.prioridad = filtros.prioridad;
      }

      if (filtros.tipo !== "todos") {
        params.tipo = filtros.tipo;
      }

      const [listaResponse, estadisticasResponse] =
        await Promise.all([
          api.get("/alertas", { params }),
          api.get("/alertas/estadisticas", { params }),
        ]);

      setAlertas(
        Array.isArray(listaResponse.data.alertas)
          ? listaResponse.data.alertas
          : []
      );

      setPaginacion(
        listaResponse.data.paginacion || {
          total: 0,
          pagina: 1,
          limite: 20,
          total_paginas: 0,
        }
      );

      setEstadisticas(
        estadisticasResponse.data.estadisticas || {
          total: 0,
          pendientes: 0,
          revisadas: 0,
          resueltas: 0,
          descartadas: 0,
          preventivas: 0,
          criticas: 0,
        }
      );
    } catch (err) {
      console.error("Error cargando alertas:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar las alertas."
      );
    } finally {
      setCargando(false);
    }
  }, [pagina, filtros]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ==========================================
  // CAMBIAR FILTROS
  // ==========================================

  const cambiarFiltro = (campo, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
    }));

    setPagina(1);
  };

  // ==========================================
  // GENERAR ALERTAS
  // ==========================================

  const generarAhora = async () => {
    try {
      setGenerando(true);
      setError("");
      setMensaje("");

      const response = await api.post("/alertas/generar");

      setMensaje(
        response.data.mensaje ||
          "Proceso de generación de alertas completado."
      );

      setPagina(1);

      await cargarDatos();
    } catch (err) {
      console.error("Error generando alertas:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron generar las alertas."
      );
    } finally {
      setGenerando(false);
    }
  };

  // ==========================================
  // CAMBIAR ESTADO
  // ==========================================

  const actualizarEstado = async (alerta, accion) => {
    const confirmaciones = {
      revisar: "¿Marcar esta alerta como revisada?",
      resolver: "¿Confirmas que esta alerta está resuelta?",
      descartar: "¿Deseas descartar esta alerta?",
    };

    if (!window.confirm(confirmaciones[accion])) {
      return;
    }

    try {
      setAccionando(alerta.id_alerta);
      setError("");
      setMensaje("");

      const response = await api.patch(
        `/alertas/${alerta.id_alerta}/${accion}`
      );

      setMensaje(
        response.data.mensaje ||
          "Estado de alerta actualizado correctamente."
      );

      setAlertaSeleccionada(null);

      await cargarDatos();
    } catch (err) {
      console.error("Error actualizando alerta:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudo actualizar el estado de la alerta."
      );
    } finally {
      setAccionando(null);
    }
  };

  // ==========================================
  // PAGINACION
  // ==========================================

  const cambiarPagina = (nuevaPagina) => {
    if (
      nuevaPagina < 1 ||
      nuevaPagina > paginacion.total_paginas
    ) {
      return;
    }

    setPagina(nuevaPagina);
  };

  // ==========================================
  // CONTADORES DE ESTADISTICAS
  // ==========================================

  const tarjetas = [
    {
      titulo: "Total de alertas",
      valor: estadisticas.total,
      icono: BellRing,
      clase: "alerts-stat-teal",
    },
    {
      titulo: "Pendientes",
      valor: estadisticas.pendientes,
      icono: Clock3,
      clase: "alerts-stat-orange",
    },
    {
      titulo: "Preventivas",
      valor: estadisticas.preventivas,
      icono: AlertTriangle,
      clase: "alerts-stat-blue",
    },
    {
      titulo: "Críticas",
      valor: estadisticas.criticas,
      icono: ShieldAlert,
      clase: "alerts-stat-red",
    },
  ];

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="alerts-page">

      {/* ENCABEZADO */}

      <div className="alerts-header">
        <div>
          <div className="alerts-title">
            <BellRing size={24} />
            <h1>Sistema de alertas</h1>
          </div>

          <p>
            Monitorea los avisos de crecimiento, controles y vacunación.
          </p>
        </div>

        <div className="alerts-header-actions">
          <button
            type="button"
            className="alerts-btn alerts-btn-outline"
            onClick={cargarDatos}
            disabled={cargando}
            title="Actualizar"
          >
            <RefreshCw
              size={17}
              className={cargando ? "alerts-spinning" : ""}
            />
          </button>

          <button
            type="button"
            className="alerts-btn alerts-btn-primary"
            onClick={generarAhora}
            disabled={generando}
          >
            <Activity size={17} />
            {generando ? "Generando..." : "Generar alertas"}
          </button>
        </div>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="alerts-message alerts-message-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Cerrar error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {mensaje && (
        <div className="alerts-message alerts-message-success">
          <CheckCircleIcon />
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

      {/* ESTADISTICAS */}

      <div className="alerts-stats">
        {tarjetas.map((tarjeta) => {
          const Icono = tarjeta.icono;

          return (
            <div
              className="alerts-stat-card"
              key={tarjeta.titulo}
            >
              <div className={`alerts-stat-icon ${tarjeta.clase}`}>
                <Icono size={21} />
              </div>

              <div className="alerts-stat-info">
                <span>{tarjeta.titulo}</span>
                <strong>{tarjeta.valor ?? 0}</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* RESUMEN DE ESTADOS */}

      <div className="alerts-status-summary">
        <div>
          <span className="alerts-dot dot-pending" />
          Pendientes: <strong>{estadisticas.pendientes}</strong>
        </div>

        <div>
          <span className="alerts-dot dot-reviewed" />
          Revisadas: <strong>{estadisticas.revisadas}</strong>
        </div>

        <div>
          <span className="alerts-dot dot-resolved" />
          Resueltas: <strong>{estadisticas.resueltas}</strong>
        </div>

        <div>
          <span className="alerts-dot dot-discarded" />
          Descartadas: <strong>{estadisticas.descartadas}</strong>
        </div>
      </div>

      {/* FILTROS */}

      <div className="alerts-filters-card">
        <div className="alerts-filter-heading">
  <Filter size={18} />
  <strong>Filtros de búsqueda</strong>
</div>

        <div className="alerts-filters">
          <div className="alerts-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Buscar paciente o descripción..."
              value={filtros.buscar}
              onChange={(e) =>
                cambiarFiltro("buscar", e.target.value)
              }
            />
          </div>

          <select
            value={filtros.estado}
            onChange={(e) =>
              cambiarFiltro("estado", e.target.value)
            }
          >
            <option value="todas">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="revisada">Revisadas</option>
            <option value="resuelta">Resueltas</option>
            <option value="descartada">Descartadas</option>
          </select>

          <select
            value={filtros.prioridad}
            onChange={(e) =>
              cambiarFiltro("prioridad", e.target.value)
            }
          >
            <option value="todas">Todas las prioridades</option>
            <option value="preventiva">Preventivas</option>
            <option value="critica">Críticas</option>
          </select>

          <select
            value={filtros.tipo}
            onChange={(e) =>
              cambiarFiltro("tipo", e.target.value)
            }
          >
            <option value="todos">Todos los tipos</option>
            <option value="crecimiento_bajo">Crecimiento bajo</option>
            <option value="crecimiento_alto">Crecimiento elevado</option>
            <option value="control_atrasado">Control atrasado</option>
            <option value="vacuna_pendiente">Vacuna próxima</option>
            <option value="vacuna_atrasada">Vacuna atrasada</option>
          </select>

          <button
            type="button"
            className="alerts-btn alerts-btn-outline"
            onClick={() => {
              setFiltros({
                buscar: "",
                estado: "todas",
                prioridad: "todas",
                tipo: "todos",
              });
              setPagina(1);
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* TABLA */}

      <div className="alerts-table-container">
        <div className="alerts-table-heading">
          <div>
            <h2>Listado de alertas</h2>
            <p>
              {paginacion.total} registros encontrados.
            </p>
          </div>

          <BellRing size={21} />
        </div>

        <div className="alerts-table-scroll">
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Alerta</th>
                <th>Tipo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="7" className="alerts-empty">
                    <RefreshCw size={19} className="alerts-spinning" />
                    Cargando alertas...
                  </td>
                </tr>
              ) : alertas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="alerts-empty">
                    <BellRing size={27} />
                    <strong>No hay alertas para mostrar</strong>
                    <span>
                      Prueba cambiando los filtros o genera nuevas alertas.
                    </span>
                  </td>
                </tr>
              ) : (
                alertas.map((alerta) => {
                  const IconoTipo = iconoTipo(alerta.tipo_alerta);

                  return (
                    <tr key={alerta.id_alerta}>
                      <td>
                        <div className="alerts-patient">
                          <div className="alerts-patient-avatar">
                            <UserRound size={17} />
                          </div>

                          <div>
                            <strong>
                              {alerta.paciente_nombres}{" "}
                              {alerta.paciente_apellidos}
                            </strong>

                            <span>
                              {alerta.comunidad_nombre ||
                                "Sin comunidad"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="alerts-title-cell">
                          <strong>{alerta.titulo}</strong>
                          <span>
                            {alerta.descripcion}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="alerts-type">
                          <IconoTipo size={14} />
                          {TIPOS[alerta.tipo_alerta] ||
                            alerta.tipo_alerta}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`alerts-badge ${
                            alerta.prioridad === "critica"
                              ? "badge-critical"
                              : "badge-preventive"
                          }`}
                        >
                          {nombrePrioridad(alerta.prioridad)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`alerts-badge badge-${alerta.estado}`}
                        >
                          {nombreEstado(alerta.estado)}
                        </span>
                      </td>

                      <td className="alerts-date">
                        {formatearFecha(alerta.fecha_deteccion)}
                      </td>

                      <td>
                        <div className="alerts-actions">
                          <button
                            type="button"
                            className="alerts-icon-btn"
                            title="Ver detalle"
                            onClick={() =>
                              setAlertaSeleccionada(alerta)
                            }
                          >
                            <Eye size={16} />
                          </button>

                          {alerta.estado === "pendiente" && (
                            <>
                              <button
                                type="button"
                                className="alerts-icon-btn action-review"
                                title="Marcar revisada"
                                disabled={
                                  accionando === alerta.id_alerta
                                }
                                onClick={() =>
                                  actualizarEstado(alerta, "revisar")
                                }
                              >
                                <Check size={16} />
                              </button>

                              <button
                                type="button"
                                className="alerts-icon-btn action-resolve"
                                title="Resolver"
                                disabled={
                                  accionando === alerta.id_alerta
                                }
                                onClick={() =>
                                  actualizarEstado(alerta, "resolver")
                                }
                              >
                                <CheckCheck size={16} />
                              </button>
                            </>
                          )}

                          {alerta.estado === "revisada" && (
                            <button
                              type="button"
                              className="alerts-icon-btn action-resolve"
                              title="Resolver"
                              disabled={
                                accionando === alerta.id_alerta
                              }
                              onClick={() =>
                                actualizarEstado(alerta, "resolver")
                              }
                            >
                              <CheckCheck size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACION */}

        {!cargando && paginacion.total_paginas > 1 && (
          <div className="alerts-pagination">
            <span>
              Página {paginacion.pagina} de{" "}
              {paginacion.total_paginas}
            </span>

            <div>
              <button
                type="button"
                className="alerts-icon-btn"
                disabled={pagina <= 1}
                onClick={() => cambiarPagina(pagina - 1)}
              >
                <ChevronLeft size={17} />
              </button>

              <button
                type="button"
                className="alerts-icon-btn"
                disabled={pagina >= paginacion.total_paginas}
                onClick={() => cambiarPagina(pagina + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}

      {alertaSeleccionada && (
        <div
          className="alerts-modal-overlay"
          onClick={() => setAlertaSeleccionada(null)}
        >
          <div
            className="alerts-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alerts-modal-header">
              <div>
                <span className="alerts-modal-overline">
                  Alerta #{alertaSeleccionada.id_alerta}
                </span>

                <h2>{alertaSeleccionada.titulo}</h2>
              </div>

              <button
                type="button"
                className="alerts-icon-btn"
                onClick={() => setAlertaSeleccionada(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="alerts-modal-body">
              <div className="alerts-detail-patient">
                <UserRound size={19} />
                <div>
                  <strong>
                    {alertaSeleccionada.paciente_nombres}{" "}
                    {alertaSeleccionada.paciente_apellidos}
                  </strong>
                  <span>
                    {alertaSeleccionada.comunidad_nombre ||
                      "Sin comunidad"}
                  </span>
                </div>
              </div>

              <div className="alerts-detail-grid">
                <div>
                  <span>Tipo</span>
                  <strong>
                    {TIPOS[alertaSeleccionada.tipo_alerta] ||
                      alertaSeleccionada.tipo_alerta}
                  </strong>
                </div>

                <div>
                  <span>Prioridad</span>
                  <strong>
                    {nombrePrioridad(alertaSeleccionada.prioridad)}
                  </strong>
                </div>

                <div>
                  <span>Estado</span>
                  <strong>
                    {nombreEstado(alertaSeleccionada.estado)}
                  </strong>
                </div>

                <div>
                  <span>Origen</span>
                  <strong>{alertaSeleccionada.origen}</strong>
                </div>

                <div>
                  <span>Fecha de detección</span>
                  <strong>
                    {formatearFecha(alertaSeleccionada.fecha_deteccion)}
                  </strong>
                </div>

                <div>
                  <span>Fecha de revisión</span>
                  <strong>
                    {formatearFecha(alertaSeleccionada.fecha_revision)}
                  </strong>
                </div>
              </div>

              <div className="alerts-detail-description">
                <span>Descripción</span>
                <p>{alertaSeleccionada.descripcion}</p>
              </div>

              {alertaSeleccionada.datos && (
                <details className="alerts-extra-data">
                  <summary>Ver datos técnicos de la evaluación</summary>
                  <pre>
                    {JSON.stringify(
                      typeof alertaSeleccionada.datos === "string"
                        ? JSON.parse(alertaSeleccionada.datos)
                        : alertaSeleccionada.datos,
                      null,
                      2
                    )}
                  </pre>
                </details>
              )}
            </div>

            {["pendiente", "revisada"].includes(
              alertaSeleccionada.estado
            ) && (
              <div className="alerts-modal-footer">
                {alertaSeleccionada.estado === "pendiente" && (
                  <button
                    type="button"
                    className="alerts-btn alerts-btn-outline"
                    disabled={
                      accionando === alertaSeleccionada.id_alerta
                    }
                    onClick={() =>
                      actualizarEstado(alertaSeleccionada, "revisar")
                    }
                  >
                    <Check size={16} />
                    Revisar
                  </button>
                )}

                <button
                  type="button"
                  className="alerts-btn alerts-btn-primary"
                  disabled={
                    accionando === alertaSeleccionada.id_alerta
                  }
                  onClick={() =>
                    actualizarEstado(alertaSeleccionada, "resolver")
                  }
                >
                  <CheckCheck size={16} />
                  Resolver
                </button>

                <button
                  type="button"
                  className="alerts-btn alerts-btn-danger"
                  disabled={
                    accionando === alertaSeleccionada.id_alerta
                  }
                  onClick={() =>
                    actualizarEstado(alertaSeleccionada, "descartar")
                  }
                >
                  <X size={16} />
                  Descartar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon() {
  return <CheckCheck size={17} />;
}
