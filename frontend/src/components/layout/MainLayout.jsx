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

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <div className={`app-main ${collapsed ? "main-expanded" : ""}`}>
        <Topbar
          title={title}
          subtitle={subtitle}
          usuario={usuario}
          onLogout={onLogout}
        />

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}