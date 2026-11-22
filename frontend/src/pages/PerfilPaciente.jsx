
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
  Baby,
  Info,
  Users,
  Mail,
  MessageCircle,
  Star,
  ShieldCheck,
  Building2,
  UserCheck,
  QrCode,
} from "lucide-react";

import api from "../services/api";
import IndicadoresCrecimiento from "./IndicadoresCrecimiento";
import GraficasCrecimiento from "./GraficasCrecimiento";
import CarnetPacientePanel from "../components/CarnetPacientePanel";

// ============================================
// CONFIGURACION DE INDICADORES OMS
// ============================================

const INDICADORES = {
  peso_edad: "Peso para la edad",
  talla_edad: "Talla para la edad",
  peso_talla: "Peso para la talla",
  perimetro_cefalico: "Perímetro cefálico para la edad",
};

// ============================================
// UTILIDADES
// ============================================

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

function obtenerPadres(valor) {
  if (Array.isArray(valor)) return valor;

  if (typeof valor === "string") {
    try {
      const resultado = JSON.parse(valor);
      return Array.isArray(resultado) ? resultado : [];
    } catch {
      return [];
    }
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

  return estados[estado] ||
    String(estado || "Sin clasificación").replaceAll("_", " ");
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
  return new Date(
    `${String(valor).substring(0, 10)}T00:00:00`
  ).getTime();
}

function nombreCanal(canal) {
  const canales = {
    email: "Correo electrónico",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
  };

  return canales[canal] || "No definido";
}

// ============================================
// TARJETA DE EVALUACION OMS
// ============================================

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

      <span
        className={`profile-oms-state ${claseEstado(
          evaluacion.estado
        )}`}
      >
        {nombreEstado(evaluacion.estado)}
      </span>

      <div className="profile-oms-measurement">
        Medición: {evaluacion.medicion ?? "—"}{" "}
        {evaluacion.unidad || ""}
      </div>
    </div>
  );
}

// ============================================
// HISTORIAL DE EVALUACIONES
// ============================================

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
              <strong>
                {nombreIndicador(evaluacion.indicador)}
              </strong>

              <span
                className={`profile-oms-state ${claseEstado(
                  evaluacion.estado
                )}`}
              >
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
                  {evaluacion.medicion ?? "—"}{" "}
                  {evaluacion.unidad || ""}
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
              {evaluacion.descripcion ||
                "Sin descripción disponible."}
            </p>

            {evaluacion.referencia?.archivo && (
              <details className="profile-oms-reference">
                <summary>Ver referencia OMS utilizada</summary>

                <div>
                  <span>
                    Archivo: {evaluacion.referencia.archivo}
                  </span>

                  <span>
                    Versión: {evaluacion.referencia.version || "—"}
                  </span>

                  <span>
                    Parámetros LMS: L ={" "}
                    {evaluacion.referencia.L ??
                      evaluacion.referencia.l ??
                      "—"}
                    , M ={" "}
                    {evaluacion.referencia.M ??
                      evaluacion.referencia.m ??
                      "—"}
                    , S ={" "}
                    {evaluacion.referencia.S ??
                      evaluacion.referencia.s ??
                      "—"}
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

// ============================================
// TARJETA DE PADRE O ENCARGADO
// ============================================

function PadreFamiliaCard({ padre }) {
  const principal = padre.es_contacto_principal === true;

  return (
    <div
      className={`profile-family-card ${
        principal ? "profile-family-primary" : ""
      }`}
    >
      <div className="profile-family-avatar">
        <UserRound size={22} />
      </div>

      <div className="profile-family-details">
        <div className="profile-family-name">
          <strong>
            {padre.nombres} {padre.apellidos}
          </strong>

          {principal && (
            <span className="profile-family-primary-badge">
              <Star size={12} />
              Contacto principal
            </span>
          )}
        </div>

        <span className="profile-family-relation">
          {padre.parentesco || "Responsable"}
        </span>

        <div className="profile-family-contact">
          {padre.telefono && (
            <span>
              <Phone size={14} />
              {padre.telefono}
            </span>
          )}

          {padre.correo && (
            <span>
              <Mail size={14} />
              {padre.correo}
            </span>
          )}

          {padre.dpi && (
            <span>
              <ShieldCheck size={14} />
              DPI: {padre.dpi}
            </span>
          )}
        </div>

        <div className="profile-family-channel">
          <MessageCircle size={13} />
          Canal preferido: {nombreCanal(padre.canal_preferido)}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function PerfilPaciente({ id, onVolver }) {
  const [paciente, setPaciente] = useState(null);
  const [crecimiento, setCrecimiento] = useState([]);
  const [vacunaciones, setVacunaciones] = useState([]);

  const [tab, setTab] = useState("informacion");

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // ==========================================
  // CARGAR PERFIL
  // ==========================================

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

      setError(
        err.response?.data?.mensaje ||
          "No se pudo cargar toda la información del paciente."
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, [id]);

  // ==========================================
  // DATOS DERIVADOS
  // ==========================================

  const fecha = (valor) => formatearFecha(valor);

  const padres = obtenerPadres(paciente?.padres);

  const comunidadNombre =
    paciente?.comunidad_nombre ||
    paciente?.comunidad?.nombre ||
    "Sin comunidad asignada";

  const comunidadUbicacion =
    paciente?.comunidad?.ubicacion || "";

  const contactoPrincipal = padres.find(
    (padre) => padre.es_contacto_principal === true
  );

  const nombreEncargado =
    contactoPrincipal
      ? `${contactoPrincipal.nombres} ${contactoPrincipal.apellidos}`
      : paciente?.nombre_encargado || "Sin encargado registrado";

  const telefonoEncargado =
    contactoPrincipal?.telefono ||
    paciente?.telefono_encargado ||
    "Sin teléfono registrado";

  const crecimientoOrdenado = [...crecimiento].sort(
    (a, b) =>
      fechaOrden(b.fecha_control) -
      fechaOrden(a.fecha_control)
  );

  const ultimoControl = crecimientoOrdenado[0];

  const evaluacionesUltimoControl = obtenerEvaluaciones(
    ultimoControl?.evaluaciones_oms
  );

  // ==========================================
  // CALCULAR EDAD
  // ==========================================

  const edad = (valor) => {
    if (!valor) return "—";

    const nacimiento = new Date(
      `${String(valor).substring(0, 10)}T00:00:00`
    );

    const hoy = new Date();

    let anios =
      hoy.getFullYear() - nacimiento.getFullYear();

    let meses =
      hoy.getMonth() - nacimiento.getMonth();

    if (hoy.getDate() < nacimiento.getDate()) {
      meses--;
    }

    if (meses < 0) {
      anios--;
      meses += 12;
    }

    return anios > 0
      ? `${anios} años, ${meses} meses`
      : `${Math.max(meses, 0)} meses`;
  };

  // ==========================================
  // ESTADOS DE CARGA
  // ==========================================

  if (cargando) {
    return (
      <div className="profile-loading">
        <RefreshCw size={20} />
        Cargando perfil del paciente...
      </div>
    );
  }

  if (error || !paciente) {
    return (
      <div className="profile-error">
        <p>{error || "Paciente no encontrado."}</p>

        <button className="profile-btn" onClick={onVolver}>
          <ArrowLeft size={16} />
          Volver
        </button>
      </div>
    );
  }

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="patient-profile">

      {/* ENCABEZADO */}

      <div className="profile-header">
        <button
          className="profile-btn profile-back"
          onClick={onVolver}
        >
          <ArrowLeft size={17} />
          Volver a pacientes
        </button>

        <button
          className="profile-btn"
          onClick={cargarPerfil}
          disabled={cargando}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* TARJETA PRINCIPAL */}

      <div className="profile-card">
        <div className="profile-avatar">
          <UserRound size={30} />
        </div>

        <div className="profile-main-info">
          <h1>
            {paciente.nombres} {paciente.apellidos}
          </h1>

          <p>Expediente de paciente</p>

          <span
            className={`patients-status ${
              paciente.estado === "inactivo"
                ? "inactive"
                : "active"
            }`}
          >
            {paciente.estado === "inactivo"
              ? "Inactivo"
              : "Activo"}
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
              {paciente.sexo === "masculino"
                ? "Masculino"
                : "Femenino"}
            </span>
          </div>

          <div>
            <MapPin size={17} />
            <span>{comunidadNombre}</span>
          </div>
        </div>
      </div>

      {/* ESTADISTICAS */}

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

        <div className="profile-stat">
          <Users size={20} />
          <div>
            <strong>{padres.length}</strong>
            <span>Padres y responsables</span>
          </div>
        </div>
      </div>

      {/* PESTAÑAS */}

      <div className="profile-tabs">
        <button
          className={tab === "informacion" ? "active" : ""}
          onClick={() => setTab("informacion")}
        >
          <UserRound size={15} />
          Información
        </button>

        <button
          className={tab === "familia" ? "active" : ""}
          onClick={() => setTab("familia")}
        >
          <Users size={15} />
          Familia
        </button>

        <button
          className={tab === "crecimiento" ? "active" : ""}
          onClick={() => setTab("crecimiento")}
        >
          <Activity size={15} />
          Crecimiento
        </button>

        <button
          className={tab === "vacunacion" ? "active" : ""}
          onClick={() => setTab("vacunacion")}
        >
          <Syringe size={15} />
          Vacunación
        </button>
        <button
  className={tab === "carnet" ? "active" : ""}
  onClick={() => setTab("carnet")}
>
  <QrCode size={15} />
  Carnet QR
</button>
      </div>

      {/* ======================================
          INFORMACION PERSONAL
      ====================================== */}

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
              <span>Edad actual</span>
              <strong>{edad(paciente.fecha_nacimiento)}</strong>
            </div>

            <div className="profile-info-item">
              <span>Sexo</span>
              <strong>
                {paciente.sexo === "masculino"
                  ? "Masculino"
                  : "Femenino"}
              </strong>
            </div>

            <div className="profile-info-item">
              <span>Encargado principal</span>
              <strong>{nombreEncargado}</strong>
            </div>

            <div className="profile-info-item">
              <span>Teléfono del encargado</span>
              <strong>
                <Phone size={14} />
                {telefonoEncargado}
              </strong>
            </div>

            <div className="profile-info-item profile-full">
              <span>Dirección del paciente</span>
              <strong>
                <MapPin size={14} />
                {paciente.direccion || "—"}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* ======================================
          COMUNIDAD Y FAMILIA
      ====================================== */}

      {tab === "familia" && (
        <div className="profile-family-content">

          {/* COMUNIDAD */}

          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Comunidad de residencia</h3>
                <p>
                  Localidad a la que pertenece el paciente.
                </p>
              </div>

              <Building2 size={22} />
            </div>

            <div className="profile-community-card">
              <div className="profile-community-icon">
                <MapPin size={23} />
              </div>

              <div>
                <span>Comunidad asignada</span>
                <strong>{comunidadNombre}</strong>

                {comunidadUbicacion && (
                  <small>{comunidadUbicacion}</small>
                )}
              </div>
            </div>

            {!paciente.id_comunidad && (
              <div className="profile-family-notice">
                <Info size={16} />
                Este paciente todavía no tiene una comunidad asignada.
              </div>
            )}
          </div>

          {/* RESPONSABLES */}

          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Padres y responsables</h3>
                <p>
                  Personas asociadas al expediente del paciente.
                </p>
              </div>

              <Users size={22} />
            </div>

            {padres.length === 0 ? (
              <div className="profile-empty">
                <Users size={27} />
                <p>No hay padres o responsables asociados.</p>
                <span>
                  Puedes administrar las asociaciones desde
                  el módulo Padres de familia.
                </span>
              </div>
            ) : (
              <div className="profile-family-list">
                {padres.map((padre) => (
                  <PadreFamiliaCard
                    key={padre.id_padre}
                    padre={padre}
                  />
                ))}
              </div>
            )}
          </div>

          {/* CONTACTO PRINCIPAL */}

          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Contacto principal</h3>
                <p>
                  Responsable seleccionado para las comunicaciones.
                </p>
              </div>

              <UserCheck size={22} />
            </div>

            {contactoPrincipal ? (
              <div className="profile-primary-contact">
                <div className="profile-primary-icon">
                  <Star size={20} />
                </div>

                <div>
                  <strong>
                    {contactoPrincipal.nombres}{" "}
                    {contactoPrincipal.apellidos}
                  </strong>

                  <span>
                    {contactoPrincipal.parentesco || "Responsable"}
                  </span>

                  <small>
                    {contactoPrincipal.telefono ||
                      "Sin teléfono registrado"}
                  </small>
                </div>
              </div>
            ) : (
              <div className="profile-empty">
                No se ha designado un contacto principal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================
          CRECIMIENTO
      ====================================== */}

      {tab === "crecimiento" && (
        <div className="profile-growth-content">

          <div className="profile-content">
            <div className="profile-section-heading">
              <div>
                <h3>Seguimiento del crecimiento</h3>
                <p>
                  Resumen de las mediciones registradas del paciente.
                </p>
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
                    ? `Control del ${fecha(
                        ultimoControl.fecha_control
                      )}`
                    : "Todavía no hay evaluaciones registradas."}
                </p>
              </div>

              <Scale size={21} />
            </div>

            {evaluacionesUltimoControl.length === 0 ? (
              <div className="profile-empty">
                No hay evaluaciones OMS disponibles para el último control.
                Los controles anteriores a la integración OMS pueden no
                tener evaluaciones almacenadas.
              </div>
            ) : (
              <div className="profile-oms-summary">
                {evaluacionesUltimoControl.map((evaluacion) => (
                  <IndicadorOmsCard
                    key={
                      evaluacion.id_evaluacion ||
                      evaluacion.indicador
                    }
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
                  Mediciones y resultados OMS ordenados del más reciente
                  al más antiguo.
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
                        <EvaluacionesControl
                          evaluaciones={evaluaciones}
                        />
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

      {/* ======================================
          VACUNACION
      ====================================== */}

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
                      {vacuna.vacuna ||
                        vacuna.nombre_vacuna ||
                            vacuna.nombre ||
                          "Vacuna"}
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
      {/* ======================================
          CARNET DIGITAL QR
      ====================================== */}

      {tab === "carnet" && (
        <CarnetPacientePanel
          paciente={paciente}
          padres={padres}
        />
      )}
    </div>
  );
}
