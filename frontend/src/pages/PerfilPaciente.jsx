
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
  Scale,
  Ruler,
  Baby,
  Info,
} from "lucide-react";

import api from "../services/api";
import IndicadoresCrecimiento from "./IndicadoresCrecimiento";
import GraficasCrecimiento from "./GraficasCrecimiento";

const INDICADORES = {
  peso_edad: "Peso para la edad",
  talla_edad: "Talla para la edad",
  peso_talla: "Peso para la talla",
  perimetro_cefalico: "Perímetro cefálico para la edad",
};

function obtenerEvaluaciones(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) return valor;

  if (typeof valor === "string") {
    try {
      const parseado = JSON.parse(valor);
      return Array.isArray(parseado) ? parseado : [];
    } catch {
      return [];
    }
  }

  if (typeof valor === "object") {
    return Object.entries(valor).map(([indicador, evaluacion]) => ({
      ...evaluacion,
      indicador: evaluacion.indicador || indicador,
    }));
  }

  return [];
}

function nombreIndicador(indicador) {
  return INDICADORES[indicador] || indicador || "Indicador";
}

function nombreEstado(estado) {
  const estados = {
    normal: "Dentro del rango de referencia",
    talla_baja: "Talla baja para la edad",
    talla_muy_baja: "Talla muy baja para la edad",
    peso_bajo: "Peso bajo para la edad",
    peso_muy_bajo: "Peso muy bajo para la edad",
    desnutricion_aguda: "Peso bajo para la talla",
    desnutricion_aguda_severa: "Peso muy bajo para la talla",
    sobrepeso: "Peso elevado para la talla",
    obesidad: "Peso muy elevado para la talla",
    perimetro_bajo: "Perímetro cefálico bajo",
    perimetro_alto: "Perímetro cefálico elevado",
    no_evaluable: "No evaluable",
  };

  return estados[estado] || String(estado || "Sin clasificación").replaceAll("_", " ");
}

function claseEstado(estado) {
  if (estado === "normal") return "status-normal";

  const criticos = [
    "talla_muy_baja",
    "peso_muy_bajo",
    "desnutricion_aguda_severa",
    "obesidad",
  ];

  if (criticos.includes(estado)) return "status-critical";

  if (estado === "no_evaluable") return "status-unknown";

  return "status-warning";
}

function formatearFecha(valor) {
  if (!valor) return "—";

  const texto = String(valor).substring(0, 10);
  const [anio, mes, dia] = texto.split("-").map(Number);

  if (!anio || !mes || !dia) return "—";

  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fechaOrden(valor) {
  return new Date(`${String(valor).substring(0, 10)}T00:00:00`).getTime();
}

function IndicadorOmsCard({ evaluacion }) {
  return (
    <div className="profile-oms-card">
      <div className="profile-oms-card-header">
        <span>{nombreIndicador(evaluacion.indicador)}</span>
        <Activity size={18} />
      </div>

      <div className="profile-oms-score">
        {Number(evaluacion.puntuacion_z).toFixed(4)}
      </div>

      <span className={`profile-oms-state ${claseEstado(evaluacion.estado)}`}>
        {nombreEstado(evaluacion.estado)}
      </span>

      <div className="profile-oms-measurement">
        Medición: {evaluacion.medicion ?? "—"} {evaluacion.unidad || ""}
      </div>
    </div>
  );
}

function EvaluacionesControl({ evaluaciones }) {
  if (!evaluaciones.length) {
    return (
      <div className="profile-oms-empty">
        <Info size={17} />
        <span>
          Este control no tiene evaluaciones OMS almacenadas.
        </span>
      </div>
    );
  }

  return (
    <div className="profile-oms-history">
      <h4>
        <Activity size={16} />
        Evaluaciones OMS
      </h4>

      <div className="profile-oms-history-grid">
        {evaluaciones.map((evaluacion) => (
          <div
            className="profile-oms-history-item"
            key={evaluacion.id_evaluacion || evaluacion.indicador}
          >
            <div className="profile-oms-history-top">
              <strong>{nombreIndicador(evaluacion.indicador)}</strong>

              <span className={`profile-oms-state ${claseEstado(evaluacion.estado)}`}>
                {nombreEstado(evaluacion.estado)}
              </span>
            </div>

            <div className="profile-oms-history-values">
              <div>
                <span>Puntuación Z</span>
                <strong>
                  {Number(evaluacion.puntuacion_z).toFixed(4)}
                </strong>
              </div>

              <div>
                <span>Medición</span>
                <strong>
                  {evaluacion.medicion ?? "—"} {evaluacion.unidad || ""}
                </strong>
              </div>

              <div>
                <span>Edad al control</span>
                <strong>
                  {evaluacion.edad_meses ?? "—"} meses
                </strong>
              </div>
            </div>

            <p className="profile-oms-description">
              {evaluacion.descripcion || "Sin descripción disponible."}
            </p>

            {evaluacion.referencia?.archivo && (
              <details className="profile-oms-reference">
                <summary>Ver referencia OMS utilizada</summary>

                <div>
                  <span>Archivo: {evaluacion.referencia.archivo}</span>
                  <span>Versión: {evaluacion.referencia.version || "—"}</span>
                  <span>
                    Parámetros LMS: L = {evaluacion.referencia.L ?? "—"},
                    {" "}M = {evaluacion.referencia.M ?? "—"},
                    {" "}S = {evaluacion.referencia.S ?? "—"}
                  </span>
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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

      setCrecimiento(
        Array.isArray(c.data)
          ? c.data
          : c.data.controles || []
      );

      setVacunaciones(
        Array.isArray(v.data)
          ? v.data
          : v.data.vacunaciones || []
      );
    } catch (err) {
      console.error("Error al cargar perfil:", err);
      setError("No se pudo cargar toda la información del paciente.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, [id]);

  const fecha = (valor) => formatearFecha(valor);

  const edad = (valor) => {
    if (!valor) return "—";

    const nacimiento = new Date(`${String(valor).substring(0, 10)}T00:00:00`);
    const hoy = new Date();

    let anios = hoy.getFullYear() - nacimiento.getFullYear();
    let meses = hoy.getMonth() - nacimiento.getMonth();

    if (hoy.getDate() < nacimiento.getDate()) meses--;

    if (meses < 0) {
      anios--;
      meses += 12;
    }

    return anios > 0
      ? `${anios} años, ${meses} meses`
      : `${Math.max(meses, 0)} meses`;
  };

  const crecimientoOrdenado = [...crecimiento].sort(
    (a, b) => fechaOrden(b.fecha_control) - fechaOrden(a.fecha_control)
  );

  const ultimoControl = crecimientoOrdenado[0];

  const evaluacionesUltimoControl = obtenerEvaluaciones(
    ultimoControl?.evaluaciones_oms
  );

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

        <button
          className="profile-btn"
          onClick={cargarPerfil}
          disabled={cargando}
        >
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
            <span>
              {paciente.sexo === "masculino" ? "Masculino" : "Femenino"}
            </span>
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
        <div className="profile-growth-content">
          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Seguimiento del crecimiento</h3>
                <p>Resumen de las mediciones registradas del paciente.</p>
              </div>
              <Activity size={21} />
            </div>

            {crecimiento.length === 0 ? (
              <div className="profile-empty">
                No hay controles de crecimiento registrados.
              </div>
            ) : (
              <>
                <IndicadoresCrecimiento controles={crecimiento} />
                <GraficasCrecimiento pacienteId={id} />
              </>
            )}
          </div>

          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Última evaluación OMS</h3>
                <p>
                  {ultimoControl
                    ? `Control del ${fecha(ultimoControl.fecha_control)}`
                    : "Todavía no hay evaluaciones registradas."}
                </p>
              </div>
              <Scale size={21} />
            </div>

            {evaluacionesUltimoControl.length === 0 ? (
              <div className="profile-empty">
                No hay evaluaciones OMS disponibles para el último control.
                Los controles anteriores a la integración OMS pueden no tener
                evaluaciones almacenadas.
              </div>
            ) : (
              <div className="profile-oms-summary">
                {evaluacionesUltimoControl.map((evaluacion) => (
                  <IndicadorOmsCard
                    key={evaluacion.id_evaluacion || evaluacion.indicador}
                    evaluacion={evaluacion}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Historial de controles y evaluaciones</h3>
                <p>
                  Mediciones y resultados OMS ordenados del más reciente al más antiguo.
                </p>
              </div>
              <CalendarDays size={21} />
            </div>

            {crecimientoOrdenado.length === 0 ? (
              <div className="profile-empty">
                No hay controles registrados.
              </div>
            ) : (
              <div className="profile-history-list">
                {crecimientoOrdenado.map((control) => {
                  const evaluaciones = obtenerEvaluaciones(
                    control.evaluaciones_oms
                  );

                  return (
                    <div
                      className="profile-history-card"
                      key={control.id_control}
                    >
                      <div className="profile-history-date">
                        Control del {fecha(control.fecha_control)}
                      </div>

                      <div className="profile-measurements">
                        <div>
                          <span>Peso</span>
                          <strong>{control.peso_kg} kg</strong>
                        </div>

                        <div>
                          <span>Talla</span>
                          <strong>{control.talla_cm} cm</strong>
                        </div>

                        <div>
                          <span>Perímetro cefálico</span>
                          <strong>
                            {control.perimetro_cefalico_cm
                              ? `${control.perimetro_cefalico_cm} cm`
                              : "—"}
                          </strong>
                        </div>
                      </div>

                      {control.observaciones && (
                        <p className="profile-observations">
                          {control.observaciones}
                        </p>
                      )}

                      {evaluaciones.length > 0 ? (
                        <EvaluacionesControl evaluaciones={evaluaciones} />
                      ) : (
                        <div className="profile-oms-empty">
                          <Info size={16} />
                          Este control no tiene evaluaciones OMS guardadas.
                        </div>
                      )}

                      {control.usuario_registro && (
                        <div className="profile-control-user">
                          Registrado por: {control.usuario_registro}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "vacunacion" && (
        <div className="profile-content">
          <h3>Historial de vacunación</h3>

          {vacunaciones.length === 0 ? (
            <div className="profile-empty">
              No hay vacunas registradas.
            </div>
          ) : (
            <div className="profile-history-list">
              {vacunaciones.map((vacuna, index) => (
                <div
                  className="profile-history-card"
                  key={vacuna.id_vacunacion || index}
                >
                  <div className="profile-history-date">
                    {fecha(vacuna.fecha_aplicacion)}
                  </div>

                  <div className="profile-vaccine-info">
                    <strong>
                      {vacuna.nombre_vacuna || vacuna.nombre || "Vacuna"}
                    </strong>
                    <span>Dosis: {vacuna.dosis || "—"}</span>
                    <span>Lote: {vacuna.lote || "—"}</span>
                    <span>
                      Próxima dosis: {fecha(vacuna.proxima_dosis)}
                    </span>
                  </div>

                  {vacuna.observaciones && (
                    <p className="profile-observations">
                      {vacuna.observaciones}
                    </p>
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
