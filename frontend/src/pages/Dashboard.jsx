
import { useCallback, useEffect, useState } from "react";

import {
  Users,
  Activity,
  Syringe,
  CalendarClock,
  UserRound,
  CalendarDays,
  RefreshCw,
  BellRing,
  AlertTriangle,
  Clock3,
  ChevronRight,
  MapPin,
} from "lucide-react";

import api from "../services/api";

const TIPOS_ALERTA = {
  crecimiento_bajo: "Crecimiento bajo",
  crecimiento_alto: "Crecimiento elevado",
  control_atrasado: "Control atrasado",
  vacuna_pendiente: "Vacuna próxima",
  vacuna_atrasada: "Vacuna atrasada",
};

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "Sin fecha";

  return valor.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);

  const [estadisticasAlertas, setEstadisticasAlertas] = useState({
    total: 0,
    pendientes: 0,
    revisadas: 0,
    resueltas: 0,
    descartadas: 0,
    preventivas: 0,
    criticas: 0,
  });

  const [alertas, setAlertas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingAlertas, setLoadingAlertas] = useState(true);

  const [error, setError] = useState("");
  const [errorAlertas, setErrorAlertas] = useState("");

  // ==========================================
  // CARGAR DASHBOARD Y ALERTAS
  // ==========================================

  const cargarDashboard = useCallback(async () => {
    setLoading(true);
    setLoadingAlertas(true);

    setError("");
    setErrorAlertas("");

    const resultados = await Promise.allSettled([
      api.get("/dashboard"),
      api.get("/alertas/estadisticas"),
      api.get("/alertas", {
        params: {
          estado: "pendiente",
          pagina: 1,
          limite: 5,
        },
      }),
    ]);

    // Dashboard general
    if (resultados[0].status === "fulfilled") {
      setData(resultados[0].value.data);
    } else {
      console.error(
        "Error cargando dashboard:",
        resultados[0].reason
      );

      setError(
        resultados[0].reason?.response?.data?.mensaje ||
          "No se pudieron cargar las estadísticas generales."
      );
    }

    setLoading(false);

    // Estadísticas de alertas
    if (resultados[1].status === "fulfilled") {
      setEstadisticasAlertas(
        resultados[1].value.data.estadisticas || {
          total: 0,
          pendientes: 0,
          revisadas: 0,
          resueltas: 0,
          descartadas: 0,
          preventivas: 0,
          criticas: 0,
        }
      );
    } else {
      console.error(
        "Error cargando estadísticas de alertas:",
        resultados[1].reason
      );

      setErrorAlertas(
        "No se pudieron consultar las estadísticas de alertas."
      );
    }

    // Últimas alertas pendientes
    if (resultados[2].status === "fulfilled") {
      setAlertas(
        Array.isArray(resultados[2].value.data.alertas)
          ? resultados[2].value.data.alertas
          : []
      );
    } else {
      console.error(
        "Error cargando alertas recientes:",
        resultados[2].reason
      );

      setErrorAlertas(
        "No se pudieron cargar las alertas pendientes."
      );
    }

    setLoadingAlertas(false);
  }, []);

  useEffect(() => {
    cargarDashboard();
  }, [cargarDashboard]);

  // ==========================================
  // DATOS DEL DASHBOARD
  // ==========================================

  const estadisticas = data?.estadisticas || {};

  const pacientes = data?.pacientes_recientes || [];

  const tarjetas = [
    {
      title: "Pacientes activos",
      value: estadisticas.pacientes_activos ?? 0,
      description: "Pacientes registrados",
      icon: Users,
    },
    {
      title: "Controles realizados",
      value: estadisticas.controles_crecimiento ?? 0,
      description: "Registros de crecimiento",
      icon: Activity,
    },
    {
      title: "Vacunaciones",
      value: estadisticas.vacunaciones_aplicadas ?? 0,
      description: "Dosis administradas",
      icon: Syringe,
    },
    {
      title: "Dosis pendientes",
      value: estadisticas.dosis_pendientes ?? 0,
      description: "Próximas aplicaciones",
      icon: CalendarClock,
    },
  ];

  // ==========================================
  // NAVEGACION A ALERTAS
  // ==========================================

  const irAAlertas = () => {
    if (onNavigate) {
      onNavigate("alertas");
    }
  };

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="dashboard">

      {/* ENCABEZADO */}

      <div className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow">
            RESUMEN GENERAL
          </span>

          <h2>Panel de control</h2>

          <p>
            Resumen de la actividad del sistema SCCVI.
          </p>
        </div>

        <button
          type="button"
          className="outlined-button"
          onClick={cargarDashboard}
          disabled={loading || loadingAlertas}
        >
          <RefreshCw
            size={16}
            className={
              loading || loadingAlertas
                ? "dashboard-spinning"
                : ""
            }
          />
          Actualizar
        </button>
      </div>

      {/* ERROR GENERAL */}

      {error && (
        <div className="dashboard-error">
          <span>{error}</span>

          <button
            type="button"
            className="outlined-button"
            onClick={cargarDashboard}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ESTADISTICAS GENERALES */}

      <div className="stats-grid">
        {tarjetas.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card" key={card.title}>
              <div className="stat-card-top">
                <div className="stat-icon">
                  <Icon size={20} />
                </div>
              </div>

              <div className="stat-value">
                {loading
                  ? "..."
                  : Number(card.value).toLocaleString("es-GT")}
              </div>

              <div className="stat-title">
                {card.title}
              </div>

              <div className="stat-description">
                {card.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================================
          RESUMEN DE ALERTAS
      ====================================== */}

      <section className="dashboard-alerts-section">

        <div className="dashboard-alerts-header">
          <div>
            <div className="dashboard-alerts-title">
              <BellRing size={20} />
              <h3>Resumen de alertas</h3>
            </div>

            <p>
              Seguimiento de situaciones que requieren atención.
            </p>
          </div>

          <button
            type="button"
            className="dashboard-alerts-link"
            onClick={irAAlertas}
          >
            Ver todas
            <ChevronRight size={16} />
          </button>
        </div>

        {errorAlertas ? (
          <div className="dashboard-alerts-error">
            <AlertTriangle size={17} />
            <span>{errorAlertas}</span>

            <button
              type="button"
              onClick={cargarDashboard}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* CONTADORES */}

            <div className="dashboard-alerts-stats">
              <div className="dashboard-alert-stat">
                <div className="dashboard-alert-stat-icon pending">
                  <Clock3 size={19} />
                </div>

                <div>
                  <span>Alertas pendientes</span>
                  <strong>
                    {loadingAlertas
                      ? "..."
                      : estadisticasAlertas.pendientes ?? 0}
                  </strong>
                </div>
              </div>

              <div className="dashboard-alert-stat">
                <div className="dashboard-alert-stat-icon critical">
                  <AlertTriangle size={19} />
                </div>

                <div>
                  <span>Alertas críticas</span>
                  <strong>
                    {loadingAlertas
                      ? "..."
                      : estadisticasAlertas.criticas ?? 0}
                  </strong>
                </div>
              </div>

              <div className="dashboard-alert-stat">
                <div className="dashboard-alert-stat-icon preventive">
                  <BellRing size={19} />
                </div>

                <div>
                  <span>Alertas preventivas</span>
                  <strong>
                    {loadingAlertas
                      ? "..."
                      : estadisticasAlertas.preventivas ?? 0}
                  </strong>
                </div>
              </div>
            </div>

            {/* LISTADO DE ALERTAS PENDIENTES */}

            <div className="dashboard-alerts-list-header">
              <strong>Alertas que requieren atención</strong>
              <span>Últimos 5 registros</span>
            </div>

            {loadingAlertas ? (
              <div className="dashboard-alerts-empty">
                <RefreshCw
                  size={18}
                  className="dashboard-spinning"
                />
                Cargando alertas...
              </div>
            ) : alertas.length === 0 ? (
              <div className="dashboard-alerts-empty">
                <BellRing size={24} />

                <strong>No hay alertas pendientes</strong>

                <span>
                  No existen alertas pendientes por el momento.
                </span>
              </div>
            ) : (
              <div className="dashboard-alerts-list">
                {alertas.map((alerta) => (
                  <button
                    type="button"
                    className="dashboard-alert-item"
                    key={alerta.id_alerta}
                    onClick={irAAlertas}
                  >
                    <div
                      className={`dashboard-alert-item-icon ${
                        alerta.prioridad === "critica"
                          ? "critical"
                          : "preventive"
                      }`}
                    >
                      {alerta.prioridad === "critica" ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <Activity size={18} />
                      )}
                    </div>

                    <div className="dashboard-alert-item-info">
                      <strong>{alerta.titulo}</strong>

                      <span>
                        {alerta.paciente_nombres}{" "}
                        {alerta.paciente_apellidos}
                      </span>

                      <small>
                        <MapPin size={12} />
                        {alerta.comunidad_nombre || "Sin comunidad"}
                        {" · "}
                        {TIPOS_ALERTA[alerta.tipo_alerta] ||
                          alerta.tipo_alerta}
                      </small>
                    </div>

                    <div className="dashboard-alert-item-meta">
                      <span
                        className={`dashboard-alert-badge ${
                          alerta.prioridad === "critica"
                            ? "critical"
                            : "preventive"
                        }`}
                      >
                        {alerta.prioridad === "critica"
                          ? "Crítica"
                          : "Preventiva"}
                      </span>

                      <small>
                        {formatearFecha(alerta.fecha_deteccion)}
                      </small>
                    </div>

                    <ChevronRight
                      size={17}
                      className="dashboard-alert-chevron"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="dashboard-alerts-footer">
              <span>
                Total de alertas registradas:{" "}
                <strong>
                  {loadingAlertas
                    ? "..."
                    : estadisticasAlertas.total ?? 0}
                </strong>
              </span>

              <button
                type="button"
                className="dashboard-alerts-link"
                onClick={irAAlertas}
              >
                Gestionar alertas
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </section>

      {/* ======================================
          PANELES INFERIORES
      ====================================== */}

      <div className="dashboard-lower-grid">

        {/* PACIENTES RECIENTES */}

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Pacientes recientes</h3>
              <p>Últimos pacientes registrados</p>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-loading">
              Cargando pacientes...
            </div>
          ) : pacientes.length === 0 ? (
            <div className="dashboard-empty">
              <Users size={25} />
              <p>No hay pacientes registrados todavía.</p>
            </div>
          ) : (
            <div className="recent-patients">
              {pacientes.map((paciente) => (
                <div
                  className="recent-patient"
                  key={paciente.id_paciente}
                >
                  <div className="recent-patient-avatar">
                    <UserRound size={18} />
                  </div>

                  <div className="recent-patient-info">
                    <strong>
                      {paciente.nombres} {paciente.apellidos}
                    </strong>

                    <span>
                      <CalendarDays size={13} />
                      {formatearFecha(paciente.creado_en)}
                    </span>
                  </div>

                  <div className="patient-status">
                    Activo
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ACTIVIDAD DEL SISTEMA */}

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Actividad del sistema</h3>
              <p>Resumen de módulos</p>
            </div>
          </div>

          <div className="activity-summary">

            <div className="activity-row">
              <div className="activity-icon">
                <Users size={18} />
              </div>

              <div>
                <strong>Pacientes</strong>
                <span>Gestión de registros</span>
              </div>

              <b>
                {loading
                  ? "..."
                  : estadisticas.pacientes_activos ?? 0}
              </b>
            </div>

            <div className="activity-row">
              <div className="activity-icon">
                <Activity size={18} />
              </div>

              <div>
                <strong>Crecimiento</strong>
                <span>Controles registrados</span>
              </div>

              <b>
                {loading
                  ? "..."
                  : estadisticas.controles_crecimiento ?? 0}
              </b>
            </div>

            <div className="activity-row">
              <div className="activity-icon">
                <Syringe size={18} />
              </div>

              <div>
                <strong>Vacunación</strong>
                <span>Dosis administradas</span>
              </div>

              <b>
                {loading
                  ? "..."
                  : estadisticas.vacunaciones_aplicadas ?? 0}
              </b>
            </div>

            <div className="activity-row">
              <div className="activity-icon">
                <BellRing size={18} />
              </div>

              <div>
                <strong>Alertas</strong>
                <span>Requieren seguimiento</span>
              </div>

              <b>
                {loadingAlertas
                  ? "..."
                  : estadisticasAlertas.pendientes ?? 0}
              </b>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
