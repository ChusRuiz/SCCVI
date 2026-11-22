import { useEffect, useState } from "react";
import { Sun, Moon, LogOut, AlertTriangle, X } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function Topbar({ title, subtitle, usuario, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  useEffect(() => {
    if (!confirmarCierre) return undefined;

    const manejarEscape = (event) => {
      if (event.key === "Escape") setConfirmarCierre(false);
    };

    window.addEventListener("keydown", manejarEscape);
    return () => window.removeEventListener("keydown", manejarEscape);
  }, [confirmarCierre]);

  const cerrarSesion = () => {
    setConfirmarCierre(false);
    onLogout?.();
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-icon-button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="topbar-user">
            <div className="user-avatar">
              {usuario?.nombre?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="user-info">
              <strong>{usuario?.nombre || "Usuario"}</strong>
              <span>{usuario?.rol || "Personal médico"}</span>
            </div>

            <button
              type="button"
              className="user-logout-button"
              onClick={() => setConfirmarCierre(true)}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={17} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {confirmarCierre && (
        <div
          className="logout-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmarCierre(false);
            }
          }}
        >
          <section
            className="logout-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
          >
            <button
              type="button"
              className="logout-confirm-close"
              onClick={() => setConfirmarCierre(false)}
              aria-label="Cerrar ventana"
            >
              <X size={18} />
            </button>

            <div className="logout-confirm-icon">
              <AlertTriangle size={25} />
            </div>

            <h2 id="logout-confirm-title">¿Cerrar sesión?</h2>
            <p id="logout-confirm-description">
              ¿Estás seguro de que deseas salir de SCCVI? Tendrás que volver a
              iniciar sesión para acceder al sistema.
            </p>

            <div className="logout-confirm-actions">
              <button
                type="button"
                className="logout-confirm-cancel"
                onClick={() => setConfirmarCierre(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="logout-confirm-submit"
                onClick={cerrarSesion}
              >
                <LogOut size={16} />
                Sí, cerrar sesión
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
