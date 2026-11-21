
import { useEffect, useState } from "react";
import {
  Activity,
  Plus,
  Search,
  RefreshCw,
  X,
  UserRound,
  CalendarDays,
} from "lucide-react";
import api from "../services/api";
import GraficasCrecimiento from "./GraficasCrecimiento";
import IndicadoresCrecimiento from "./IndicadoresCrecimiento";

const formularioInicial = {
  id_paciente: "",
  fecha_control: new Date().toISOString().split("T")[0],
  peso_kg: "",
  talla_cm: "",
  perimetro_cefalico_cm: "",
  observaciones: "",
};

export default function Crecimiento() {
  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState("");
  const [controles, setControles] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [modal, setModal] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  // Cargar pacientes activos
  const cargarPacientes = async () => {
    try {
      const response = await api.get("/pacientes");
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.pacientes || [];

      setPacientes(data.filter((p) => p.estado !== "inactivo"));
    } catch (err) {
      setError("No se pudieron cargar los pacientes.");
    }
  };

  // Cargar historial del paciente
  const cargarControles = async (id) => {
    if (!id) {
      setControles([]);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const response = await api.get(`/crecimiento/paciente/${id}`);
      const data = response.data;

      setControles(Array.isArray(data) ? data : data.controles || []);
    } catch (err) {
      setError("No se pudo cargar el historial de crecimiento.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPacientes();
  }, []);

  useEffect(() => {
    cargarControles(pacienteId);
  }, [pacienteId]);

  const pacienteSeleccionado = pacientes.find(
    (p) => String(p.id_paciente) === String(pacienteId)
  );

  const cambiarCampo = (e) => {
    const { name, value } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  };

  const abrirModal = () => {
    setFormulario({
      ...formularioInicial,
      id_paciente: pacienteId,
      fecha_control: new Date().toISOString().split("T")[0],
    });
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setFormulario({ ...formularioInicial });
  };

  // Registrar control
  const guardarControl = async (e) => {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");

      await api.post("/crecimiento", {
        ...formulario,
        id_paciente: pacienteId,
        peso_kg: Number(formulario.peso_kg),
        talla_cm: Number(formulario.talla_cm),
        perimetro_cefalico_cm: formulario.perimetro_cefalico_cm
          ? Number(formulario.perimetro_cefalico_cm)
          : null,
      });

      cerrarModal();
      await cargarControles(pacienteId);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "No se pudo registrar el control."
      );
    } finally {
      setGuardando(false);
    }
  };

  const formatearFecha = (valor) => {
    if (!valor) return "—";

    return new Date(`${String(valor).substring(0, 10)}T00:00:00`)
      .toLocaleDateString("es-GT");
  };

  const controlesFiltrados = controles.filter((control) => {
    const texto = busqueda.toLowerCase();

    return (
      String(control.observaciones || "")
        .toLowerCase()
        .includes(texto) ||
      String(control.fecha_control || "").includes(texto)
    );
  });

  return (
    <div className="growth-page">
      {/* Encabezado */}
      <div className="growth-header">
        <div>
          <div className="growth-title">
            <Activity size={23} />
            <h1>Control de crecimiento</h1>
          </div>
          <p>Seguimiento de peso, talla y desarrollo infantil.</p>
        </div>

        <button
          className="growth-btn growth-primary"
          onClick={abrirModal}
          disabled={!pacienteId}
        >
          <Plus size={17} />
          Nuevo control
        </button>
      </div>

      {error && <div className="growth-error">{error}</div>}

      {/* Seleccionar paciente */}
      <div className="growth-patient-selector">
        <label>Seleccionar paciente</label>

        <select
          value={pacienteId}
          onChange={(e) => setPacienteId(e.target.value)}
        >
          <option value="">Selecciona un paciente...</option>

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

      {/* Resumen del paciente */}
      {pacienteSeleccionado && (
        <div className="growth-patient-card">
          <div className="growth-patient-avatar">
            <UserRound size={22} />
          </div>

          <div>
            <strong>
              {pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidos}
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
      

      {/* Historial */}
      <div className="growth-history-container">
        <IndicadoresCrecimiento controles={controles} />
        <GraficasCrecimiento controles={controles} />
        <div className="growth-history-header">
          <div>
            <h2>Historial de mediciones</h2>
            <p>Registros de crecimiento del paciente seleccionado.</p>
          </div>

          <button
            className="growth-btn"
            onClick={() => cargarControles(pacienteId)}
            disabled={!pacienteId}
            title="Actualizar historial"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {pacienteId && (
          <div className="growth-search">
            <Search size={17} />
            <input
              placeholder="Buscar en observaciones o fecha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")}>
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {!pacienteId ? (
          <div className="growth-empty">
            <Activity size={30} />
            <strong>Selecciona un paciente</strong>
            <p>Para visualizar su historial de crecimiento.</p>
          </div>
        ) : cargando ? (
          <div className="growth-empty">Cargando historial...</div>
        ) : controlesFiltrados.length === 0 ? (
          <div className="growth-empty">
            <Activity size={30} />
            <strong>No hay controles registrados</strong>
            <p>Registra el primer control de crecimiento.</p>
          </div>
        ) : (
          <div className="growth-table-wrapper">
            <table className="growth-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th>Talla</th>
                  <th>Perímetro cefálico</th>
                  <th>Observaciones</th>
                </tr>
              </thead>

              <tbody>
                {controlesFiltrados.map((control) => (
                  <tr key={control.id_control}>
                    <td>
                      <CalendarDays size={14} />
                      {formatearFecha(control.fecha_control)}
                    </td>
                    <td>{control.peso_kg} kg</td>
                    <td>{control.talla_cm} cm</td>
                    <td>
                      {control.perimetro_cefalico_cm
                        ? `${control.perimetro_cefalico_cm} cm`
                        : "—"}
                    </td>
                    <td>{control.observaciones || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de registro */}
      {modal && (
        <div className="growth-modal-overlay" onClick={cerrarModal}>
          <div className="growth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="growth-modal-header">
              <div>
                <h2>Registrar control</h2>
                <p>
                  {pacienteSeleccionado?.nombres}{" "}
                  {pacienteSeleccionado?.apellidos}
                </p>
              </div>

              <button className="growth-btn" onClick={cerrarModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarControl}>
              <div className="growth-form-grid">
                <div className="growth-field">
                  <label>Fecha del control *</label>
                  <input
                    type="date"
                    name="fecha_control"
                    value={formulario.fecha_control}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="growth-field">
                  <label>Peso (kg) *</label>
                  <input
                    type="number"
                    name="peso_kg"
                    value={formulario.peso_kg}
                    onChange={cambiarCampo}
                    min="0.1"
                    step="0.01"
                    placeholder="Ej. 12.50"
                    required
                  />
                </div>

                <div className="growth-field">
                  <label>Talla (cm) *</label>
                  <input
                    type="number"
                    name="talla_cm"
                    value={formulario.talla_cm}
                    onChange={cambiarCampo}
                    min="1"
                    step="0.1"
                    placeholder="Ej. 85.5"
                    required
                  />
                </div>

                <div className="growth-field">
                  <label>Perímetro cefálico (cm)</label>
                  <input
                    type="number"
                    name="perimetro_cefalico_cm"
                    value={formulario.perimetro_cefalico_cm}
                    onChange={cambiarCampo}
                    min="1"
                    step="0.1"
                    placeholder="Opcional"
                  />
                </div>

                <div className="growth-field growth-field-full">
                  <label>Observaciones</label>
                  <textarea
                    name="observaciones"
                    value={formulario.observaciones}
                    onChange={cambiarCampo}
                    rows="3"
                    placeholder="Observaciones del control..."
                  />
                </div>
              </div>

              <div className="growth-modal-footer">
                <button
                  type="button"
                  className="growth-btn"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="growth-btn growth-primary"
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Guardar control"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
