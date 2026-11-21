
import {
  LayoutDashboard,
  Users,
  Activity,
  Syringe,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  HeartPulse,
  MapPin,
  UserRound,
} from "lucide-react";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pacientes", label: "Pacientes", icon: Users },
  { id: "comunidades", label: "Comunidades", icon: MapPin },
  { id: "padres", label: "Padres de familia", icon: UserRound },
  { id: "crecimiento", label: "Crecimiento", icon: Activity },
  { id: "vacunacion", label: "Vacunación", icon: Syringe },
  
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

      <nav className="sidebar-nav">
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
            >
              <Icon size={19} strokeWidth={1.8} />

              {!collapsed && <span>{item.label}</span>}

              {active && (
                <span className="sidebar-active-indicator" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-divider" />

        <button
          type="button"
          className={`sidebar-item ${
            activePage === "configuracion" ? "active" : ""
          }`}
          onClick={() => onNavigate("configuracion")}
          title={collapsed ? "Configuración" : undefined}
        >
          <Settings size={19} strokeWidth={1.8} />
          {!collapsed && <span>Configuración</span>}
        </button>

        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
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
