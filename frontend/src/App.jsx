
import { useState } from "react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import Crecimiento from "./pages/Crecimiento";
import Comunidades from "./pages/Comunidades";
import Padres from "./pages/Padres";
import Alertas from "./pages/Alertas";
import Notificaciones from "./pages/Notificaciones";
import CarnetPublico from "./pages/CarnetPublico";
import Campanas from "./pages/Campanas";
import Reportes from "./pages/Reportes";
import Vacunacion from "./pages/Vacunacion";

import MainLayout from "./components/layout/MainLayout";

function App() {
  const [usuario, setUsuario] = useState(() => {
    const token = localStorage.getItem("sccvi-token");

    return token ? { autenticado: true } : null;
  });

  const [activePage, setActivePage] = useState("dashboard");

  // El carnet QR es una vista pública, independiente del login del personal.
  const coincidenciaCarnet = window.location.pathname.match(/^\/carnet\/([a-f0-9]{64})\/?$/i);

  const handleLogin = (user) => {
    setUsuario(user || { autenticado: true });
  };

  const handleLogout = () => {
    localStorage.removeItem("sccvi-token");
    setUsuario(null);
    setActivePage("dashboard");
  };

  if (coincidenciaCarnet) {
    return <CarnetPublico token={coincidenciaCarnet[1]} />;
  }

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
    alertas: {
  title: "Sistema de alertas",
  subtitle: "Monitoreo de alertas y seguimiento infantil",
},
notificaciones: {
  title: "Notificaciones",
  subtitle: "Historial de envíos por correo y Telegram",
},
campanas: {
  title: "Campañas comunitarias",
  subtitle: "Jornadas de vacunación y controles médicos",
},
reportes: {
  title: "Reportes",
  subtitle: "Indicadores de crecimiento y vacunación",
},
  };

  const contenido = {
    dashboard: <Dashboard onNavigate={setActivePage} />,
    pacientes: <Pacientes />,
    comunidades: <Comunidades />,
    padres: <Padres />,
    crecimiento: <Crecimiento />,
    alertas: <Alertas />,
    notificaciones: <Notificaciones />,
    campanas: <Campanas />,
    reportes: <Reportes />,
    vacunacion: <Vacunacion />,
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
