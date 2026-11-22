import {
  LayoutDashboard,
  Users,
  Activity,
  Syringe,
  PanelLeftClose,
  PanelLeftOpen,
  HeartPulse,
  MapPin,
  UserRound,
  BellRing,
  Megaphone,
  FileBarChart,
} from "lucide-react";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pacientes", label: "Pacientes", icon: Users },
  { id: "comunidades", label: "Comunidades", icon: MapPin },
  { id: "padres", label: "Padres de familia", icon: UserRound },
  { id: "crecimiento", label: "Crecimiento", icon: Activity },
  { id: "vacunacion", label: "Vacunación", icon: Syringe },
  { id: "alertas", label: "Alertas", icon: BellRing },
  { id: "notificaciones", label: "Notificaciones", icon: BellRing },
  { id: "campanas", label: "Campañas", icon: Megaphone },
  { id: "reportes", label: "Reportes", icon: FileBarChart },
];

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
}) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <HeartPulse size={22} />
        </div>

        {!collapsed && (
          <div className="sidebar-brand-text">
            <strong>SCCVI</strong>
            <span>Control infantil</span>
          </div>
        )}
      </div>

      <div className="sidebar-section-label">
        {!collapsed && "MENU PRINCIPAL"}
      </div>

      <nav className="sidebar-nav" aria-label="Menú principal">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${active ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              {!collapsed && <span>{item.label}</span>}
              {active && <span className="sidebar-active-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
          {!collapsed && <span>Contraer menú</span>}
        </button>
      </div>
    </aside>
  );
}
