import { useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  HeartPulse,
  Sun,
  Moon,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";

export default function Login({ onLogin }) {
  const { theme, toggleTheme } = useTheme();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        correo,
        password,
      });

      localStorage.setItem("sccvi-token", response.data.token);

      onLogin(response.data.usuario || response.data.user);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "Correo o contraseña incorrectos"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Fondo decorativo */}
      <div className="login-background">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="orb orb-three" />
        <div className="grid-overlay" />
      </div>

      {/* Botón de tema */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="theme-button"
        onClick={toggleTheme}
      >
        {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </motion.button>

      <div className="login-container">
        {/* Panel informativo */}
        <motion.div
          className="login-brand-panel"
          initial={{ opacity: 0, x: -35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="brand-content">
            <div className="brand-logo">
              <HeartPulse size={30} />
            </div>

            <span className="brand-label">SCCVI</span>

            <h1>
              Cuidando el
              <br />
              <span>crecimiento.</span>
            </h1>

            <p>
              Sistema de Control de Crecimiento y Vacunación Infantil.
              Tecnología diseñada para acompañar cada etapa del desarrollo.
            </p>

            <div className="brand-features">
              <div className="feature-item">
                <ShieldCheck size={18} />
                <span>Información protegida</span>
              </div>

              <div className="feature-item">
                <HeartPulse size={18} />
                <span>Control infantil integral</span>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <span className="status-dot" />
            Plataforma de gestión de salud infantil
          </div>
        </motion.div>

        {/* Panel de acceso */}
        <motion.div
          className="login-form-panel"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15 }}
    >
          <div className="login-form-content">
            <div className="mobile-brand">
              <div className="brand-logo">
                <HeartPulse size={26} />
              </div>
              <span>SCCVI</span>
            </div>

            <div className="login-heading">
              <span className="welcome-label">BIENVENIDO</span>
              <h2>Inicia sesión</h2>
              <p>Ingresa tus credenciales para continuar.</p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Correo */}
              <div className="input-group">
                <label htmlFor="correo">Correo electrónico</label>

                <div className="input-wrapper">
                  <Mail size={19} className="input-icon" />

                  <input
                    id="correo"
                    type="email"
                    placeholder="nombre@correo.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div className="input-group">
                <label htmlFor="password">Contraseña</label>

                <div className="input-wrapper">
                  <LockKeyhole size={19} className="input-icon" />

                  <input
                    id="password"
                    type={mostrarPassword ? "text" : "password"}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                  >
                    {mostrarPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  className="login-error"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              {/* Botón */}
              <motion.button
                type="submit"
                className="login-submit"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
              >
                <span>{loading ? "Verificando..." : "Iniciar sesión"}</span>
                {!loading && <ArrowRight size={19} />}
              </motion.button>
            </form>

            <div className="login-security">
              <ShieldCheck size={16} />
              <span>Acceso seguro y autorizado</span>
            </div>
          </div>

          <div className="login-copyright">
            SCCVI · Sistema de Control de Crecimiento y Vacunación Infantil
          </div>
        </motion.div>
      </div>
    </div>
  );
}