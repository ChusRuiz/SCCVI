
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  UserRound,
  CalendarDays,
  Activity,
  Syringe,
  Phone,
  MapPin,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

export default function PerfilPaciente({ id, onVolver }) {
  const [paciente, setPaciente] = useState(null);
  const [crecimiento, setCrecimiento] = useState([]);
  const [vacunaciones, setVacunaciones] = useState([]);
  const [tab, setTab] = useState("informacion");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarPerfil = async () => {
    try {
      setCargando(true);
      setError("");

      const [p, c, v] = await Promise.all([
        api.get(`/pacientes/${id}`),
        api.get(`/crecimiento/paciente/${id}`),
        api.get(`/vacunacion/paciente/${id}`),
      ]);

      setPaciente(p.data.paciente || p.data);
      setCrecimiento(Array.isArray(c.data) ? c.data : c.data.controles || []);
      setVacunaciones(Array.isArray(v.data) ? v.data : v.data.vacunaciones || []);
    } catch (err) {
      setError("No se pudo cargar toda la información del paciente.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, [id]);

  const fecha = (valor) => {
    if (!valor) return "—";
    return new Date(`${String(valor).substring(0, 10)}T00:00:00`)
      .toLocaleDateString("es-GT");
  };

  const edad = (valor) => {
    if (!valor) return "—";

    const nacimiento = new Date(`${valor.substring(0, 10)}T00:00:00`);
    const hoy = new Date();

    let anios = hoy.getFullYear() - nacimiento.getFullYear();
    let meses = hoy.getMonth() - nacimiento.getMonth();

    if (hoy.getDate() < nacimiento.getDate()) meses--;
    if (meses < 0) {
      anios--;
      meses += 12;
    }

    return anios > 0 ? `${anios} años` : `${Math.max(meses, 0)} meses`;
  };

  if (cargando) {
    return <div className="profile-loading">Cargando perfil...</div>;
  }

  if (error || !paciente) {
    return (
      <div className="profile-error">
        <p>{error || "Paciente no encontrado."}</p>
        <button className="profile-btn" onClick={onVolver}>
          <ArrowLeft size={16} /> Volver
        </button>
      </div>
    );
  }

  return (
    <div className="patient-profile">
      <div className="profile-header">
        <button className="profile-btn profile-back" onClick={onVolver}>
          <ArrowLeft size={17} /> Volver a pacientes
        </button>

        <button className="profile-btn" onClick={cargarPerfil}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          <UserRound size={30} />
        </div>

        <div className="profile-main-info">
          <h1>{paciente.nombres} {paciente.apellidos}</h1>
          <p>Expediente de paciente</p>
          <span className={`patients-status ${paciente.estado === "inactivo" ? "inactive" : "active"}`}>
            {paciente.estado === "inactivo" ? "Inactivo" : "Activo"}
          </span>
        </div>

        <div className="profile-quick-info">
          <div>
            <CalendarDays size={17} />
            <span>{edad(paciente.fecha_nacimiento)}</span>
          </div>
          <div>
            <UserRound size={17} />
            <span>{paciente.sexo === "masculino" ? "Masculino" : "Femenino"}</span>
          </div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <Activity size={20} />
          <div>
            <strong>{crecimiento.length}</strong>
            <span>Controles de crecimiento</span>
          </div>
        </div>

        <div className="profile-stat">
          <Syringe size={20} />
          <div>
            <strong>{vacunaciones.length}</strong>
            <span>Vacunas registradas</span>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        <button
          className={tab === "informacion" ? "active" : ""}
          onClick={() => setTab("informacion")}
        >
          Información
        </button>
        <button
          className={tab === "crecimiento" ? "active" : ""}
          onClick={() => setTab("crecimiento")}
        >
          <Activity size={15} /> Crecimiento
        </button>
        <button
          className={tab === "vacunacion" ? "active" : ""}
          onClick={() => setTab("vacunacion")}
        >
          <Syringe size={15} /> Vacunación
        </button>
      </div>

      {tab === "informacion" && (
        <div className="profile-content">
          <h3>Información personal</h3>

          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span>Nombres</span>
              <strong>{paciente.nombres || "—"}</strong>
            </div>
            <div className="profile-info-item">
              <span>Apellidos</span>
              <strong>{paciente.apellidos || "—"}</strong>
            </div>
            <div className="profile-info-item">
              <span>CUI</span>
              <strong>{paciente.cui || "—"}</strong>
            </div>
            <div className="profile-info-item">
              <span>Fecha de nacimiento</span>
              <strong>{fecha(paciente.fecha_nacimiento)}</strong>
            </div>
            <div className="profile-info-item">
              <span>Nombre del encargado</span>
              <strong>{paciente.nombre_encargado || "—"}</strong>
            </div>
            <div className="profile-info-item">
              <span>Teléfono</span>
              <strong>
                <Phone size={14} /> {paciente.telefono_encargado || "—"}
              </strong>
            </div>
            <div className="profile-info-item profile-full">
              <span>Dirección</span>
              <strong>
                <MapPin size={14} /> {paciente.direccion || "—"}
              </strong>
            </div>
          </div>
        </div>
      )}

      {tab === "crecimiento" && (
        <div className="profile-content">
          <h3>Historial de crecimiento</h3>

          {crecimiento.length === 0 ? (
            <div className="profile-empty">No hay controles registrados.</div>
          ) : (
            <div className="profile-history-list">
              {crecimiento.map((control) => (
                <div className="profile-history-card" key={control.id_control}>
                  <div className="profile-history-date">
                    {fecha(control.fecha_control)}
                  </div>
                  <div className="profile-measurements">
                    <div><span>Peso</span><strong>{control.peso_kg} kg</strong></div>
                    <div><span>Talla</span><strong>{control.talla_cm} cm</strong></div>
                    <div><span>Perímetro cefálico</span><strong>{control.perimetro_cefalico_cm ? `${control.perimetro_cefalico_cm} cm` : "—"}</strong></div>
                  </div>
                  {control.observaciones && (
                    <p className="profile-observations">{control.observaciones}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "vacunacion" && (
        <div className="profile-content">
          <h3>Historial de vacunación</h3>

          {vacunaciones.length === 0 ? (
            <div className="profile-empty">No hay vacunas registradas.</div>
          ) : (
            <div className="profile-history-list">
              {vacunaciones.map((vacuna, index) => (
                <div className="profile-history-card" key={vacuna.id_vacunacion || index}>
                  <div className="profile-history-date">
                    {fecha(vacuna.fecha_aplicacion)}
                  </div>
                  <div className="profile-vaccine-info">
                    <strong>{vacuna.nombre_vacuna || vacuna.nombre || "Vacuna"}</strong>
                    <span>Dosis: {vacuna.dosis || "—"}</span>
                    <span>Lote: {vacuna.lote || "—"}</span>
                    <span>Próxima dosis: {fecha(vacuna.proxima_dosis)}</span>
                  </div>
                  {vacuna.observaciones && (
                    <p className="profile-observations">{vacuna.observaciones}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
