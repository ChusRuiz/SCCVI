import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function Topbar({ title, subtitle, usuario, onLogout }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="topbar-actions">
        {/* Search */}
        <button className="topbar-icon-button" title="Buscar">
          <Search size={18} />
        </button>

        {/* Notifications */}
        <button className="topbar-icon-button notification-button" title="Notificaciones">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>

        {/* Theme */}
        <button
          className="topbar-icon-button"
          onClick={toggleTheme}
          title="Cambiar tema"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User */}
        <div className="topbar-user">
          <div className="user-avatar">
            {usuario?.nombre?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="user-info">
            <strong>{usuario?.nombre || "Usuario"}</strong>
            <span>{usuario?.rol || "Personal médico"}</span>
          </div>

          <button
            className="user-logout-button"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}