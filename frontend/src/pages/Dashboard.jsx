import {
  Users,
  Activity,
  Syringe,
  CalendarClock,
  ArrowUpRight,
} from "lucide-react";

const cards = [
  {
    title: "Pacientes activos",
    value: "—",
    description: "Total de pacientes registrados",
    icon: Users,
  },
  {
    title: "Controles realizados",
    value: "—",
    description: "Registros de crecimiento",
    icon: Activity,
  },
  {
    title: "Vacunaciones",
    value: "—",
    description: "Dosis administradas",
    icon: Syringe,
  },
  {
    title: "Dosis pendientes",
    value: "—",
    description: "Próximas aplicaciones",
    icon: CalendarClock,
  },
];

export default function Dashboard() {
  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow">RESUMEN GENERAL</span>
          <h2>Panel de control</h2>
          <p>Resumen de la actividad del sistema SCCVI.</p>
        </div>

        <button className="outlined-button">
          <Activity size={17} />
          Estado del sistema
        </button>
      </div>

      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card" key={card.title}>
              <div className="stat-card-top">
                <div className="stat-icon">
                  <Icon size={20} />
                </div>

                <ArrowUpRight size={17} className="stat-arrow" />
              </div>

              <div className="stat-value">{card.value}</div>
              <div className="stat-title">{card.title}</div>
              <div className="stat-description">{card.description}</div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-lower-grid">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Actividad de crecimiento</h3>
              <p>Seguimiento de controles infantiles</p>
            </div>
          </div>

          <div className="empty-chart">
            <Activity size={30} />
            <p>Estadísticas de crecimiento</p>
            <span>Próximamente</span>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Próximas vacunaciones</h3>
              <p>Dosis que requieren seguimiento</p>
            </div>
          </div>

          <div className="empty-chart">
            <CalendarClock size={30} />
            <p>Control de próximas dosis</p>
            <span>Próximamente</span>
          </div>
        </section>
      </div>
    </div>
  );
}