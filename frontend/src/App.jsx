import { useEffect, useState } from "react";

import api from "./services/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import Crecimiento from "./pages/Crecimiento";
import Comunidades from "./pages/Comunidades";
import Padres from "./pages/Padres";
import Vacunacion from "./pages/Vacunacion";
import Alertas from "./pages/Alertas";
import Notificaciones from "./pages/Notificaciones";
import Campanas from "./pages/Campanas";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import CarnetPublico from "./pages/CarnetPublico";

import MainLayout from "./components/layout/MainLayout";
import { obtenerPaginasPermitidas } from "./utils/rolesSccvi";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [usuario, setUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(
    Boolean(localStorage.getItem("sccvi-token"))
  );

  // El carnet público debe abrirse sin iniciar sesión en el panel del personal.
  const coincidenciaCarnet = window.location.pathname.match(
    /^\/carnet\/([a-f0-9]{64})\/?$/i
  );
  const esCarnetPublico = Boolean(coincidenciaCarnet);

  // Revalidar el token y recuperar el rol vigente directamente del backend.
  useEffect(() => {
    if (esCarnetPublico) {
      setVerificandoSesion(false);
      return undefined;
    }

    const token = localStorage.getItem("sccvi-token");

    if (!token) {
      setUsuario(null);
      setVerificandoSesion(false);
      return undefined;
    }

    let componenteActivo = true;

    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!componenteActivo) return;

        const usuarioActual = data?.usuario;
        if (!usuarioActual?.rol) {
          throw new Error("El backend no devolvió un rol válido.");
        }

        setUsuario(usuarioActual);
        localStorage.setItem(
          "sccvi-usuario",
          JSON.stringify(usuarioActual)
        );
      })
      .catch(() => {
        if (!componenteActivo) return;

        localStorage.removeItem("sccvi-token");
        localStorage.removeItem("sccvi-usuario");
        setUsuario(null);
      })
      .finally(() => {
        if (componenteActivo) setVerificandoSesion(false);
      });

    return () => {
      componenteActivo = false;
    };
  }, [esCarnetPublico]);

  // Si el rol cambia, evitar que el usuario permanezca en una página no autorizada.
  useEffect(() => {
    if (!usuario) return;

    const paginas = obtenerPaginasPermitidas(usuario.rol);
    if (paginas.length > 0 && !paginas.includes(activePage)) {
      setActivePage("dashboard");
    }
  }, [usuario, activePage]);

  const handleLogin = (user) => {
    if (!user) return;

    localStorage.setItem("sccvi-usuario", JSON.stringify(user));
    setUsuario(user);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("sccvi-token");
    localStorage.removeItem("sccvi-usuario");
    setUsuario(null);
    setActivePage("dashboard");
  };

  // Vista pública del carnet QR: no requiere la sesión del personal.
  if (esCarnetPublico) {
    return <CarnetPublico token={coincidenciaCarnet[1]} />;
  }

  if (verificandoSesion) {
    return (
      <div className="session-loading" role="status" aria-live="polite">
        Verificando sesión...
      </div>
    );
  }

  if (!usuario) {
    return <Login onLogin={handleLogin} />;
  }

  const paginasPermitidas = obtenerPaginasPermitidas(usuario.rol);

  const navegar = (pagina) => {
    if (paginasPermitidas.includes(pagina)) {
      setActivePage(pagina);
    }
  };

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
    alertas: {
      title: "Sistema de alertas",
      subtitle: "Monitoreo de alertas y seguimiento infantil",
    },
    notificaciones: {
      title: "Notificaciones",
      subtitle: "Historial de envíos por correo y Telegram",
    },
    campanas: {
      title: "Campañas",
      subtitle: "Jornadas de vacunación y controles comunitarios",
    },
    reportes: {
      title: "Reportes",
      subtitle: "Indicadores de crecimiento y vacunación",
    },
    usuarios: {
      title: "Usuarios y roles",
      subtitle: "Administración de cuentas y permisos del personal",
    },
  };

  const contenido = {
    dashboard: <Dashboard onNavigate={navegar} />,
    pacientes: <Pacientes />,
    comunidades: <Comunidades />,
    padres: <Padres />,
    crecimiento: <Crecimiento />,
    vacunacion: <Vacunacion />,
    alertas: <Alertas />,
    notificaciones: <Notificaciones />,
    campanas: <Campanas />,
    reportes: <Reportes />,
    usuarios: <Usuarios />,
  };

  const paginaActual = pageInfo[activePage] ? activePage : "dashboard";

  return (
    <MainLayout
      activePage={paginaActual}
      onNavigate={navegar}
      usuario={usuario}
      onLogout={handleLogout}
      title={pageInfo[paginaActual].title}
      subtitle={pageInfo[paginaActual].subtitle}
    >
      {contenido[paginaActual]}
    </MainLayout>
  );
}

export default App;
