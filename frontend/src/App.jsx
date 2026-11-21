import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./components/layout/MainLayout";

function App() {
  const [usuario, setUsuario] = useState(() => {
    const token = localStorage.getItem("sccvi-token");
    return token ? { autenticado: true } : null;
  });

  const [activePage, setActivePage] = useState("dashboard");

  const handleLogin = (user) => {
    setUsuario(user || { autenticado: true });
  };

  const handleLogout = () => {
    localStorage.removeItem("sccvi-token");
    setUsuario(null);
    setActivePage("dashboard");
  };

  if (!usuario) {
    return <Login onLogin={handleLogin} />;
  }

  const pageInfo = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Resumen general del sistema",
    },
    pacientes: {
      title: "Pacientes",
      subtitle: "Gestión de pacientes registrados",
    },
    crecimiento: {
      title: "Control de crecimiento",
      subtitle: "Seguimiento del desarrollo infantil",
    },
    vacunacion: {
      title: "Vacunación",
      subtitle: "Registro y seguimiento de vacunas",
    },
    configuracion: {
      title: "Configuración",
      subtitle: "Preferencias del sistema",
    },
  };

  return (
    <MainLayout
      activePage={activePage}
      onNavigate={setActivePage}
      usuario={usuario}
      onLogout={handleLogout}
      title={pageInfo[activePage].title}
      subtitle={pageInfo[activePage].subtitle}
    >
      {activePage === "dashboard" ? (
        <Dashboard />
      ) : (
        <div className="dashboard-panel">
          <h3>{pageInfo[activePage].title}</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
            Este módulo se desarrollará en las siguientes fases.
          </p>
        </div>
      )}
    </MainLayout>
  );
}

export default App;