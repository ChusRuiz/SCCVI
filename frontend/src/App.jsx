
import { useState } from "react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import Crecimiento from "./pages/Crecimiento";
import Comunidades from "./pages/Comunidades";
import Padres from "./pages/Padres";

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

    comunidades: {
      title: "Comunidades",
      subtitle: "Gestión de comunidades y localidades",
    },

    padres: {
  title: "Padres de familia",
  subtitle: "Gestión de padres, tutores y encargados",
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

  const contenido = {
    dashboard: <Dashboard />,
    pacientes: <Pacientes />,
    comunidades: <Comunidades />,
    padres: <Padres />,
    crecimiento: <Crecimiento />,
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
      {contenido[activePage] || (
        <div className="dashboard-panel">
          <h3>{pageInfo[activePage].title}</h3>

          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: 10,
            }}
          >
            Este módulo se desarrollará en las siguientes fases.
          </p>
        </div>
      )}
    </MainLayout>
  );
}

export default App;
