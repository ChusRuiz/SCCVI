import { useEffect, useState } from "react";
import {
  Users,
  Activity,
  Syringe,
  CalendarClock,
  UserRound,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/dashboard");
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudieron cargar las estadísticas"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const estadisticas = data?.estadisticas || {};

  const cards = [
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

  const pacientes = data?.pacientes_recientes || [];

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";

    return new Date(fecha).toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow">RESUMEN GENERAL</span>
          <h2>Panel de control</h2>
          <p>Resumen de la actividad del sistema SCCVI.</p>
        </div>

        <button className="outlined-button" onClick={cargarDashboard}>
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="dashboard-error">
          <span>{error}</span>
          <button className="outlined-button" onClick={cargarDashboard}>
            Reintentar
          </button>
        </div>
      )}

      {/* Estadísticas */}
      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card" key={card.title}>
              <div className="stat-card-top">
                <div className="stat-icon">
                  <Icon size={20} />
                </div>
              </div>

              <div className="stat-value">
                {loading ? "..." : card.value.toLocaleString("es-GT")}
              </div>

              <div className="stat-title">{card.title}</div>
              <div className="stat-description">{card.description}</div>
            </div>
          );
        })}
      </div>

      {/* Paneles inferiores */}
      <div className="dashboard-lower-grid">
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
                <div className="recent-patient" key={paciente.id_paciente}>
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

                  <div className="patient-status">Activo</div>
                </div>
              ))}
            </div>
          )}
        </section>

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
              <b>{loading ? "..." : estadisticas.pacientes_activos ?? 0}</b>
            </div>

            <div className="activity-row">
              <div className="activity-icon">
                <Activity size={18} />
              </div>
              <div>
                <strong>Crecimiento</strong>
                <span>Controles registrados</span>
              </div>
              <b>{loading ? "..." : estadisticas.controles_crecimiento ?? 0}</b>
            </div>

            <div className="activity-row">
              <div className="activity-icon">
                <Syringe size={18} />
              </div>
              <div>
                <strong>Vacunación</strong>
                <span>Dosis administradas</span>
              </div>
              <b>{loading ? "..." : estadisticas.vacunaciones_aplicadas ?? 0}</b>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}