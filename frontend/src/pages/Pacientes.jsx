
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  Plus,
  Pencil,
  UserX,
  RefreshCw,
  X,
  UserRound,
  Eye,
} from "lucide-react";
import api from "../services/api";
import PerfilPaciente from "./PerfilPaciente";

const formularioInicial = {
  nombres: "",
  apellidos: "",
  fecha_nacimiento: "",
  sexo: "masculino",
  cui: "",
  nombre_encargado: "",
  telefono_encargado: "",
  direccion: "",
};

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [perfilId, setPerfilId] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [guardando, setGuardando] = useState(false);

  // Cargar pacientes
  const cargarPacientes = async () => {
    try {
      setCargando(true);
      setError("");

      const response = await api.get("/pacientes");
      const data = response.data;

      setPacientes(Array.isArray(data) ? data : data.pacientes || []);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar los pacientes."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPacientes();
  }, []);

  // Buscar pacientes
  const pacientesFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    if (!texto) return pacientes;

    return pacientes.filter((p) =>
      `${p.nombres || ""} ${p.apellidos || ""} ${p.cui || ""}`
        .toLowerCase()
        .includes(texto)
    );
  }, [pacientes, busqueda]);

  // Abrir registro
  const abrirNuevo = () => {
    setEditando(null);
    setFormulario({ ...formularioInicial });
    setModal(true);
  };

  // Abrir edición
  const abrirEditar = (paciente) => {
    setEditando(paciente);

    setFormulario({
      nombres: paciente.nombres || "",
      apellidos: paciente.apellidos || "",
      fecha_nacimiento: paciente.fecha_nacimiento?.substring(0, 10) || "",
      sexo: paciente.sexo || "masculino",
      cui: paciente.cui || "",
      nombre_encargado: paciente.nombre_encargado || "",
      telefono_encargado: paciente.telefono_encargado || "",
      direccion: paciente.direccion || "",
    });

    setModal(true);
  };

  // Cerrar modal
  const cerrarModal = () => {
    setModal(false);
    setEditando(null);
    setFormulario({ ...formularioInicial });
  };

  // Cambiar campos
  const cambiarCampo = (e) => {
    const { name, value } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  };

  // Guardar paciente
  const guardarPaciente = async (e) => {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");

      if (editando) {
        await api.put(
          `/pacientes/${editando.id_paciente}`,
          formulario
        );
      } else {
        await api.post("/pacientes", formulario);
      }

      cerrarModal();
      await cargarPacientes();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "No se pudo guardar el paciente."
      );
    } finally {
      setGuardando(false);
    }
  };

  // Desactivar paciente
  const desactivarPaciente = async (paciente) => {
    const confirmar = window.confirm(
      `¿Deseas desactivar a ${paciente.nombres} ${paciente.apellidos}?`
    );

    if (!confirmar) return;

    try {
      setError("");

      await api.patch(
        `/pacientes/${paciente.id_paciente}/desactivar`
      );

      await cargarPacientes();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo desactivar el paciente."
      );
    }
  };

  // Calcular edad
  const calcularEdad = (fecha) => {
    if (!fecha) return "—";

    const nacimiento = new Date(`${fecha.substring(0, 10)}T00:00:00`);
    const hoy = new Date();

    let años = hoy.getFullYear() - nacimiento.getFullYear();
    let meses = hoy.getMonth() - nacimiento.getMonth();

    if (hoy.getDate() < nacimiento.getDate()) meses--;

    if (meses < 0) {
      años--;
      meses += 12;
    }

    if (años <= 0) return `${Math.max(meses, 0)} meses`;

    return `${años} años`;
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return "—";

    return new Date(
      `${fecha.substring(0, 10)}T00:00:00`
    ).toLocaleDateString("es-GT");
  };

  // Mostrar perfil individual
  if (perfilId !== null) {
    return (
      <PerfilPaciente
        id={perfilId}
        onVolver={() => setPerfilId(null)}
      />
    );
  }

  return (
    <div className="patients-page">
      {/* Encabezado */}
      <div className="patients-header">
        <div>
          <div className="patients-title">
            <Users size={23} />
            <h1>Pacientes</h1>
          </div>

          <p>Gestiona los registros de pacientes del sistema.</p>

          <span className="patients-total">
            {pacientes.length} pacientes registrados
          </span>
        </div>

        <div className="patients-header-actions">
          <button
            className="patients-btn patients-btn-outline"
            onClick={cargarPacientes}
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>

          <button
            className="patients-btn patients-btn-primary"
            onClick={abrirNuevo}
          >
            <Plus size={18} />
            Nuevo paciente
          </button>
        </div>
      </div>

      {/* Errores */}
      {error && <div className="patients-error">{error}</div>}

      {/* Buscador */}
      <div className="patients-toolbar">
        <div className="patients-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Buscar por nombre, apellido o CUI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {busqueda && (
            <button onClick={() => setBusqueda("")}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="patients-table-container">
        <table className="patients-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>CUI</th>
              <th>Fecha nacimiento</th>
              <th>Edad</th>
              <th>Sexo</th>
              <th>Encargado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="8" className="patients-empty">
                  Cargando pacientes...
                </td>
              </tr>
            ) : pacientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan="8" className="patients-empty">
                  {busqueda
                    ? "No se encontraron pacientes."
                    : "Todavía no hay pacientes registrados."}
                </td>
              </tr>
            ) : (
              pacientesFiltrados.map((paciente) => (
                <tr key={paciente.id_paciente}>
                  {/* Nombre */}
                  <td>
                    <div className="patients-person">
                      <div className="patients-avatar">
                        <UserRound size={18} />
                      </div>

                      <div>
                        <strong>
                          {paciente.nombres} {paciente.apellidos}
                        </strong>
                        <span>Paciente infantil</span>
                      </div>
                    </div>
                  </td>

                  <td>{paciente.cui || "—"}</td>

                  <td>{formatearFecha(paciente.fecha_nacimiento)}</td>

                  <td>{calcularEdad(paciente.fecha_nacimiento)}</td>

                  <td>
                    {paciente.sexo === "masculino"
                      ? "Masculino"
                      : "Femenino"}
                  </td>

                  <td>{paciente.nombre_encargado || "—"}</td>

                  {/* Estado */}
                  <td>
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
                  </td>

                  {/* Acciones */}
                  <td>
                    <div className="patients-actions">
                      {/* Ver perfil */}
                      <button
                        className="patients-btn patients-btn-small"
                        title="Ver perfil"
                        onClick={() =>
                          setPerfilId(paciente.id_paciente)
                        }
                      >
                        <Eye size={15} />
                      </button>

                      {/* Editar */}
                      <button
                        className="patients-btn patients-btn-small"
                        title="Editar paciente"
                        onClick={() => abrirEditar(paciente)}
                      >
                        <Pencil size={15} />
                      </button>

                      {/* Desactivar */}
                      {paciente.estado !== "inactivo" && (
                        <button
                          className="patients-btn patients-btn-small patients-btn-danger"
                          title="Desactivar paciente"
                          onClick={() => desactivarPaciente(paciente)}
                        >
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de registro y edición */}
      {modal && (
        <div
          className="patients-modal-overlay"
          onClick={cerrarModal}
        >
          <div
            className="patients-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="patients-modal-header">
              <div>
                <h2>
                  {editando ? "Editar paciente" : "Nuevo paciente"}
                </h2>

                <p>
                  {editando
                    ? "Actualiza la información del paciente."
                    : "Completa la información para registrar al paciente."}
                </p>
              </div>

              <button
                className="patients-btn"
                onClick={cerrarModal}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarPaciente}>
              <div className="patients-form-grid">
                <div className="patients-field">
                  <label>Nombres *</label>
                  <input
                    name="nombres"
                    value={formulario.nombres}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="patients-field">
                  <label>Apellidos *</label>
                  <input
                    name="apellidos"
                    value={formulario.apellidos}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="patients-field">
                  <label>Fecha de nacimiento *</label>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    value={formulario.fecha_nacimiento}
                    onChange={cambiarCampo}
                    required
                  />
                </div>

                <div className="patients-field">
                  <label>Sexo *</label>
                  <select
                    name="sexo"
                    value={formulario.sexo}
                    onChange={cambiarCampo}
                    required
                  >
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </div>

                <div className="patients-field">
                  <label>CUI</label>
                  <input
                    name="cui"
                    value={formulario.cui}
                    onChange={cambiarCampo}
                    maxLength="13"
                  />
                </div>

                <div className="patients-field">
                  <label>Teléfono encargado</label>
                  <input
                    name="telefono_encargado"
                    value={formulario.telefono_encargado}
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="patients-field patients-field-full">
                  <label>Nombre del encargado</label>
                  <input
                    name="nombre_encargado"
                    value={formulario.nombre_encargado}
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="patients-field patients-field-full">
                  <label>Dirección</label>
                  <textarea
                    name="direccion"
                    value={formulario.direccion}
                    onChange={cambiarCampo}
                    rows="2"
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="patients-modal-footer">
                <button
                  type="button"
                  className="patients-btn patients-btn-outline"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="patients-btn patients-btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : editando
                    ? "Guardar cambios"
                    : "Registrar paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
