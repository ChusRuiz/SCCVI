
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Plus,
  Search,
  RefreshCw,
  X,
  UserRound,
  CalendarDays,
  Ruler,
  Scale,
  Info,
  CheckCircle2,
} from "lucide-react";

import api from "../services/api";
import GraficasCrecimiento from "./GraficasCrecimiento";
import IndicadoresCrecimiento from "./IndicadoresCrecimiento";

// ============================================
// UTILIDADES
// ============================================

function obtenerFechaLocal() {
  const hoy = new Date();

  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function calcularEdadMeses(fechaNacimiento, fechaReferencia) {
  if (!fechaNacimiento || !fechaReferencia) return null;

  const [anioN, mesN, diaN] = String(fechaNacimiento)
    .substring(0, 10)
    .split("-")
    .map(Number);

  const [anioR, mesR, diaR] = String(fechaReferencia)
    .substring(0, 10)
    .split("-")
    .map(Number);

  if (
    !anioN || !mesN || !diaN ||
    !anioR || !mesR || !diaR
  ) {
    return null;
  }

  let meses = (anioR - anioN) * 12 + (mesR - mesN);

  if (diaR < diaN) meses--;

  return meses >= 0 ? meses : null;
}

function formatearFecha(valor) {
  if (!valor) return "—";

  const [anio, mes, dia] = String(valor)
    .substring(0, 10)
    .split("-")
    .map(Number);

  if (!anio || !mes || !dia) return "—";

  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function crearFormularioInicial() {
  return {
    id_paciente: "",
    fecha_control: obtenerFechaLocal(),
    peso_kg: "",
    talla_cm: "",
    metodo_medicion_talla: "",
    perimetro_cefalico_cm: "",
    observaciones: "",
  };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Crecimiento() {
  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState("");
  const [controles, setControles] = useState([]);

  const [formulario, setFormulario] = useState(
    crearFormularioInicial
  );

  const [modal, setModal] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ============================================
  // CARGAR PACIENTES
  // ============================================

  const cargarPacientes = async () => {
    try {
      setError("");

      const response = await api.get("/pacientes");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.pacientes || [];

      setPacientes(
        data.filter((paciente) => paciente.estado !== "inactivo")
      );
    } catch (err) {
      console.error("Error al cargar pacientes:", err);

      setError("No se pudieron cargar los pacientes.");
    }
  };

  // ============================================
  // CARGAR HISTORIAL DE CRECIMIENTO
  // ============================================

  const cargarControles = async (id) => {
    if (!id) {
      setControles([]);
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const response = await api.get(`/crecimiento/paciente/${id}`);

      const data = response.data;

      const registros = Array.isArray(data)
        ? data
        : data.controles || [];

      setControles(registros);
    } catch (err) {
      console.error("Error al cargar controles:", err);

      setError(
        err.response?.data?.mensaje ||
        "No se pudo cargar el historial de crecimiento."
      );
    } finally {
      setCargando(false);
    }
  };

  // ============================================
  // EFECTOS
  // ============================================

  useEffect(() => {
    cargarPacientes();
  }, []);

  useEffect(() => {
    cargarControles(pacienteId);
    setBusqueda("");
    setMensaje("");
  }, [pacienteId]);

  // ============================================
  // PACIENTE SELECCIONADO
  // ============================================

  const pacienteSeleccionado = useMemo(
    () =>
      pacientes.find(
        (paciente) =>
          String(paciente.id_paciente) === String(pacienteId)
      ),
    [pacientes, pacienteId]
  );

  // Edad del paciente al momento de la fecha del control.
  // Se utiliza únicamente para mostrar la recomendación de medición.
  const edadAlControl = calcularEdadMeses(
    pacienteSeleccionado?.fecha_nacimiento,
    formulario.fecha_control
  );

  const metodoRecomendado =
    edadAlControl === null
      ? null
      : edadAlControl < 24
        ? "acostado"
        : "de_pie";

  // ============================================
  // FORMULARIO
  // ============================================

  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    setFormulario((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const abrirModal = () => {
    if (!pacienteId) return;

    setError("");
    setMensaje("");

    setFormulario({
      ...crearFormularioInicial(),
      id_paciente: pacienteId,
    });

    setModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setModal(false);
    setFormulario(crearFormularioInicial());
  };

  // ============================================
  // REGISTRAR CONTROL
  // ============================================

  const guardarControl = async (e) => {
    e.preventDefault();

    if (!pacienteId) {
      setError("Debes seleccionar un paciente.");
      return;
    }

    if (!formulario.metodo_medicion_talla) {
      setError("Debes indicar cómo se realizó la medición de la talla.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const datos = {
        ...formulario,

        id_paciente: Number(pacienteId),

        peso_kg: Number(formulario.peso_kg),

        talla_cm: Number(formulario.talla_cm),

        metodo_medicion_talla: formulario.metodo_medicion_talla,

        perimetro_cefalico_cm:
          formulario.perimetro_cefalico_cm !== ""
            ? Number(formulario.perimetro_cefalico_cm)
            : null,
      };

      const response = await api.post("/crecimiento", datos);

      setModal(false);
      setFormulario(crearFormularioInicial());

      await cargarControles(pacienteId);

      setMensaje(
        response.data?.mensaje ||
        "Control y evaluaciones OMS guardados correctamente."
      );
    } catch (err) {
      console.error("Error al registrar control:", err);

      setError(
        err.response?.data?.mensaje ||
        err.response?.data?.error ||
        "No se pudo registrar el control de crecimiento."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ============================================
  // BUSQUEDA DEL HISTORIAL
  // ============================================

  const controlesOrdenados = useMemo(() => {
    return [...controles].sort(
      (a, b) =>
        new Date(`${String(b.fecha_control).substring(0, 10)}T00:00:00`) -
        new Date(`${String(a.fecha_control).substring(0, 10)}T00:00:00`)
    );
  }, [controles]);

  const controlesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return controlesOrdenados;

    return controlesOrdenados.filter((control) => {
      const fecha = formatearFecha(control.fecha_control).toLowerCase();

      const observaciones = String(
        control.observaciones || ""
      ).toLowerCase();

      const metodo = String(
        control.metodo_medicion_talla || ""
      ).toLowerCase();

      return (
        fecha.includes(texto) ||
        observaciones.includes(texto) ||
        metodo.includes(texto)
      );
    });
  }, [controlesOrdenados, busqueda]);

  // ============================================
  // RENDERIZADO
  // ============================================

  return (
    <div className="growth-page">

      {/* ENCABEZADO */}

      <div className="growth-header">
        <div>
          <div className="growth-title">
            <Activity size={23} />
            <h1>Control de crecimiento</h1>
          </div>

          <p>
            Seguimiento de peso, talla y desarrollo infantil.
          </p>
        </div>

        <button
          type="button"
          className="growth-btn growth-primary"
          onClick={abrirModal}
          disabled={!pacienteId || cargando}
        >
          <Plus size={17} />
          Nuevo control
        </button>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="growth-alert growth-alert-error">
          <Info size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Cerrar mensaje"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {mensaje && (
        <div className="growth-alert growth-alert-success">
          <CheckCircle2 size={18} />
          <span>{mensaje}</span>

          <button
            type="button"
            onClick={() => setMensaje("")}
            aria-label="Cerrar mensaje"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* SELECCIONAR PACIENTE */}

      <div className="growth-patient-selector">
        <label htmlFor="growth-paciente">
          Seleccionar paciente
        </label>

        <select
          id="growth-paciente"
          value={pacienteId}
          onChange={(e) => setPacienteId(e.target.value)}
        >
          <option value="">
            Selecciona un paciente...
          </option>

          {pacientes.map((paciente) => (
            <option
              key={paciente.id_paciente}
              value={paciente.id_paciente}
            >
              {paciente.nombres} {paciente.apellidos}
            </option>
          ))}
        </select>
      </div>

      {/* RESUMEN DEL PACIENTE */}

      {pacienteSeleccionado && (
        <div className="growth-patient-card">
          <div className="growth-patient-avatar">
            <UserRound size={22} />
          </div>

          <div className="growth-patient-info">
            <strong>
              {pacienteSeleccionado.nombres}{" "}
              {pacienteSeleccionado.apellidos}
            </strong>

            <span>
              CUI: {pacienteSeleccionado.cui || "No registrado"}
            </span>
          </div>

          <div className="growth-patient-count">
            <Activity size={18} />
            {controles.length} controles registrados
          </div>
        </div>
      )}

      {/* CONTENIDO DEL HISTORIAL */}

      <div className="growth-history-container">

        {!pacienteId ? (
          <div className="growth-empty">
            <Activity size={32} />

            <strong>Selecciona un paciente</strong>

            <p>
              Para visualizar sus controles y evolución de crecimiento.
            </p>
          </div>
        ) : cargando ? (
          <div className="growth-empty">
            <RefreshCw size={28} className="growth-loading-icon" />

            <strong>Cargando historial...</strong>
          </div>
        ) : controles.length === 0 ? (
          <div className="growth-empty">
            <Activity size={32} />

            <strong>No hay controles registrados</strong>

            <p>
              Registra el primer control de crecimiento del paciente.
            </p>
          </div>
        ) : (
          <>
            {/* INDICADORES */}

            <div className="growth-section-block">
              <div className="growth-section-heading">
                <div>
                  <h2>Resumen del crecimiento</h2>
                  <p>
                    Últimas mediciones registradas.
                  </p>
                </div>

                <Activity size={21} />
              </div>

              <IndicadoresCrecimiento controles={controles} />
            </div>

            {/* GRAFICAS */}

            <div className="growth-section-block">
              <div className="growth-section-heading">
                <div>
                  <h2>Evolución de las mediciones</h2>
                  <p>
                    Comparación de peso y talla entre controles.
                  </p>
                </div>

                <Scale size={21} />
              </div>

              <GraficasCrecimiento pacienteId={pacienteId} />
            </div>
          </>
        )}

        {/* ENCABEZADO DEL HISTORIAL */}

        <div className="growth-history-header">
          <div>
            <h2>Historial de mediciones</h2>

            <p>
              Registros de crecimiento del paciente seleccionado.
            </p>
          </div>

          <button
            type="button"
            className="growth-btn"
            onClick={() => cargarControles(pacienteId)}
            disabled={!pacienteId || cargando}
            title="Actualizar historial"
          >
            <RefreshCw
              size={16}
              className={cargando ? "growth-loading-icon" : ""}
            />
          </button>
        </div>

        {/* BUSCADOR */}

        {pacienteId && (
          <div className="growth-search">
            <Search size={17} />

            <input
              type="search"
              placeholder="Buscar por fecha, observación o método..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* TABLA */}

        {pacienteId &&
          !cargando &&
          controlesFiltrados.length === 0 &&
          controles.length > 0 && (
            <div className="growth-empty growth-empty-compact">
              <Search size={26} />
              <strong>No se encontraron resultados</strong>
              <p>Prueba con otra fecha, método u observación.</p>
            </div>
          )}

        {pacienteId &&
          !cargando &&
          controlesFiltrados.length > 0 && (
            <div className="growth-table-wrapper">
              <table className="growth-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Peso</th>
                    <th>Talla registrada</th>
                    <th>Método</th>
                    <th>Talla OMS</th>
                    <th>Perímetro cefálico</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {controlesFiltrados.map((control) => (
                    <tr key={control.id_control}>
                      <td className="growth-date-cell">
                        <CalendarDays size={14} />
                        {formatearFecha(control.fecha_control)}
                      </td>

                      <td className="growth-value-cell">
                        {control.peso_kg} kg
                      </td>

                      <td>
                        {control.talla_cm} cm
                      </td>

                      <td>
                        {control.metodo_medicion_talla === "acostado" ? (
                          <span className="growth-method-badge">
                            <Ruler size={13} />
                            Acostado
                          </span>
                        ) : control.metodo_medicion_talla === "de_pie" ? (
                          <span className="growth-method-badge">
                            <Ruler size={13} />
                            De pie
                          </span>
                        ) : (
                          <span className="growth-method-unknown">
                            No registrado
                          </span>
                        )}
                      </td>

                      <td className="growth-standard-value">
                        {control.talla_estandar_oms_cm != null
                          ? `${control.talla_estandar_oms_cm} cm`
                          : "—"}
                      </td>

                      <td>
                        {control.perimetro_cefalico_cm != null
                          ? `${control.perimetro_cefalico_cm} cm`
                          : "—"}
                      </td>

                      <td className="growth-observations">
                        {control.observaciones || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      </div>

      {/* ======================================
          MODAL DE REGISTRO
      ====================================== */}

      {modal && (
        <div
          className="growth-modal-overlay"
          onClick={cerrarModal}
        >
          <div
            className="growth-modal"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ENCABEZADO DEL MODAL */}

            <div className="growth-modal-header">
              <div>
                <h2>Registrar control</h2>

                <p>
                  {pacienteSeleccionado?.nombres}{" "}
                  {pacienteSeleccionado?.apellidos}
                </p>
              </div>

              <button
                type="button"
                className="growth-btn growth-close-btn"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar formulario"
              >
                <X size={18} />
              </button>
            </div>

            {/* FORMULARIO */}

            <form onSubmit={guardarControl}>
              <div className="growth-form-grid">

                {/* FECHA */}

                <div className="growth-field">
                  <label htmlFor="fecha_control">
                    Fecha del control *
                  </label>

                  <input
                    id="fecha_control"
                    type="date"
                    name="fecha_control"
                    value={formulario.fecha_control}
                    max={obtenerFechaLocal()}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                {/* PESO */}

                <div className="growth-field">
                  <label htmlFor="peso_kg">
                    Peso (kg) *
                  </label>

                  <input
                    id="peso_kg"
                    type="number"
                    name="peso_kg"
                    value={formulario.peso_kg}
                    onChange={cambiarCampo}
                    min="0.1"
                    max="100"
                    step="0.01"
                    placeholder="Ej. 9.50"
                    required
                  />
                </div>

                {/* TALLA */}

                <div className="growth-field">
                  <label htmlFor="talla_cm">
                    Talla (cm) *
                  </label>

                  <input
                    id="talla_cm"
                    type="number"
                    name="talla_cm"
                    value={formulario.talla_cm}
                    onChange={cambiarCampo}
                    min="1"
                    max="250"
                    step="0.1"
                    placeholder="Ej. 75.0"
                    required
                  />
                </div>

                {/* METODO DE MEDICION */}

                <div className="growth-field">
                  <label htmlFor="metodo_medicion_talla">
                    Método de medición *
                  </label>

                  <select
                    id="metodo_medicion_talla"
                    name="metodo_medicion_talla"
                    value={formulario.metodo_medicion_talla}
                    onChange={cambiarCampo}
                    required
                  >
                    <option value="">
                      Selecciona el método...
                    </option>

                    <option value="acostado">
                      Acostado (longitud)
                    </option>

                    <option value="de_pie">
                      De pie (estatura)
                    </option>
                  </select>
                </div>

                {/* RECOMENDACION SEGUN EDAD */}

                {metodoRecomendado && (
                  <div className="growth-method-information growth-field-full">
                    <Info size={17} />

                    <div>
                      <strong>
                        Método habitual según la edad:{" "}
                        {metodoRecomendado === "acostado"
                          ? "Acostado"
                          : "De pie"}
                      </strong>

                      <p>
                        Edad al control: {edadAlControl} meses.
                        Registra la posición que realmente se utilizó.
                        El backend aplicará el ajuste OMS de 0.7 cm
                        cuando corresponda.
                      </p>
                    </div>
                  </div>
                )}

                {/* PERIMETRO CEFALICO */}

                <div className="growth-field">
                  <label htmlFor="perimetro_cefalico_cm">
                    Perímetro cefálico (cm)
                  </label>

                  <input
                    id="perimetro_cefalico_cm"
                    type="number"
                    name="perimetro_cefalico_cm"
                    value={formulario.perimetro_cefalico_cm}
                    onChange={cambiarCampo}
                    min="1"
                    max="100"
                    step="0.1"
                    placeholder="Opcional"
                  />

                  <small>
                    Puedes dejarlo vacío si no se realizó esta medición.
                  </small>
                </div>

                {/* OBSERVACIONES */}

                <div className="growth-field growth-field-full">
                  <label htmlFor="observaciones">
                    Observaciones
                  </label>

                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={formulario.observaciones}
                    onChange={cambiarCampo}
                    rows="3"
                    maxLength="1000"
                    placeholder="Observaciones del control..."
                  />
                </div>

              </div>

              {/* PIE DEL MODAL */}

              <div className="growth-modal-footer">
                <button
                  type="button"
                  className="growth-btn"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="growth-btn growth-primary"
                  disabled={guardando}
                >
                  {guardando ? (
                    <>
                      <RefreshCw size={16} className="growth-loading-icon" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Guardar control
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
