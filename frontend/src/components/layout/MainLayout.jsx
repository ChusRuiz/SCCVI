import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function MainLayout({
  children,
  activePage,
  onNavigate,
  usuario,
  onLogout,
  title,
  subtitle,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => {
    setCollapsed((actual) => !actual);
  };

  return (
    <div className="app-layout">
      <Sidebar
        usuario={usuario}
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div className={`app-main ${collapsed ? "main-expanded" : ""}`}>
        <Topbar
          title={title}
          subtitle={subtitle}
          usuario={usuario}
          onLogout={onLogout}
        />

        <main className="page-content" key={activePage}>
          {children}
        </main>
      </div>
    </div>
  );
}
