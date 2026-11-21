
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
  MapPin,
  UserPlus,
  Check,
} from "lucide-react";

import api from "../services/api";
import PerfilPaciente from "./PerfilPaciente";

const formularioInicial = {
  nombres: "",
  apellidos: "",
  fecha_nacimiento: "",
  sexo: "masculino",
  cui: "",
  direccion: "",
  id_comunidad: "",
};

const obtenerArreglo = (data, propiedad) => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[propiedad])
    ? data[propiedad]
    : [];
};

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [padres, setPadres] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [perfilId, setPerfilId] = useState(null);

  const [formulario, setFormulario] = useState({
    ...formularioInicial,
  });

  const [padresSeleccionados, setPadresSeleccionados] = useState([]);
  const [relacionesPadres, setRelacionesPadres] = useState({});
  const [contactoPrincipal, setContactoPrincipal] = useState("");

  // ==========================================
  // CARGAR PACIENTES
  // ==========================================

  const cargarPacientes = async () => {
    try {
      setCargando(true);
      setError("");

      const response = await api.get("/pacientes");

      setPacientes(
        obtenerArreglo(response.data, "pacientes")
      );
    } catch (err) {
      console.error("Error al cargar pacientes:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar los pacientes."
      );
    } finally {
      setCargando(false);
    }
  };

  // ==========================================
  // CARGAR COMUNIDADES Y PADRES
  // ==========================================

  const cargarCatalogos = async () => {
    try {
      setCargandoCatalogos(true);

      const [comunidadesResponse, padresResponse] =
        await Promise.all([
          api.get("/comunidades", {
            params: { estado: "activa" },
          }),
          api.get("/padres", {
            params: { estado: "activo" },
          }),
        ]);

      setComunidades(
        obtenerArreglo(
          comunidadesResponse.data,
          "comunidades"
        ).filter((item) => item.estado === "activa")
      );

      setPadres(
        obtenerArreglo(
          padresResponse.data,
          "padres"
        ).filter((item) => item.estado === "activo")
      );
    } catch (err) {
      console.error("Error al cargar catálogos:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar las comunidades y los padres."
      );
    } finally {
      setCargandoCatalogos(false);
    }
  };

  useEffect(() => {
    cargarPacientes();
    cargarCatalogos();
  }, []);

  // ==========================================
  // FILTRAR PACIENTES
  // ==========================================

  const pacientesFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    if (!texto) return pacientes;

    return pacientes.filter((paciente) =>
      `${paciente.nombres || ""} ${
        paciente.apellidos || ""
      } ${paciente.cui || ""}`
        .toLowerCase()
        .includes(texto)
    );
  }, [pacientes, busqueda]);

  // ==========================================
  // PADRES DISPONIBLES
  // ==========================================

  const padresDisponibles = useMemo(() => {
    if (!formulario.id_comunidad) return [];

    return padres.filter(
      (padre) =>
        Number(padre.id_comunidad) ===
        Number(formulario.id_comunidad)
    );
  }, [padres, formulario.id_comunidad]);

  // ==========================================
  // ABRIR NUEVO PACIENTE
  // ==========================================

  const abrirNuevo = async () => {
    setError("");
    setMensaje("");

    await cargarCatalogos();

    setEditando(null);
    setFormulario({
      ...formularioInicial,
    });

    setPadresSeleccionados([]);
    setRelacionesPadres({});
    setContactoPrincipal("");

    setModal(true);
  };

  // ==========================================
  // ABRIR EDICIÓN
  // ==========================================

  const abrirEditar = async (paciente) => {
    setError("");
    setMensaje("");

    await cargarCatalogos();

    setEditando(paciente);

    setFormulario({
      nombres: paciente.nombres || "",
      apellidos: paciente.apellidos || "",
      fecha_nacimiento:
        paciente.fecha_nacimiento?.substring(0, 10) || "",
      sexo: paciente.sexo || "masculino",
      cui: paciente.cui || "",
      direccion: paciente.direccion || "",
      id_comunidad: paciente.id_comunidad
        ? String(paciente.id_comunidad)
        : "",
    });

    const asociaciones = Array.isArray(paciente.padres)
      ? paciente.padres
      : [];

    const seleccionados = asociaciones.map(
      (padre) => String(padre.id_padre)
    );

    const parentescos = {};

    asociaciones.forEach((padre) => {
      parentescos[String(padre.id_padre)] =
        padre.parentesco || "Tutor";
    });

    const principal = asociaciones.find(
      (padre) => padre.es_contacto_principal
    );

    setPadresSeleccionados(seleccionados);
    setRelacionesPadres(parentescos);
    setContactoPrincipal(
      principal ? String(principal.id_padre) : ""
    );

    setModal(true);
  };

  // ==========================================
  // CERRAR MODAL
  // ==========================================

  const cerrarModal = () => {
    if (guardando) return;

    setModal(false);
    setEditando(null);

    setFormulario({
      ...formularioInicial,
    });

    setPadresSeleccionados([]);
    setRelacionesPadres({});
    setContactoPrincipal("");
  };

  // ==========================================
  // CAMBIAR CAMPOS
  // ==========================================

  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    setFormulario((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "id_comunidad") {
      setPadresSeleccionados([]);
      setRelacionesPadres({});
      setContactoPrincipal("");
    }
  };

  // ==========================================
  // SELECCIONAR O QUITAR PADRES
  // ==========================================

  const alternarPadre = (idPadre) => {
    const id = String(idPadre);

    setPadresSeleccionados((prev) => {
      const existe = prev.includes(id);

      if (existe) {
        const nuevos = prev.filter(
          (item) => item !== id
        );

        setRelacionesPadres((actual) => {
          const copia = { ...actual };
          delete copia[id];
          return copia;
        });

        if (contactoPrincipal === id) {
          setContactoPrincipal(nuevos[0] || "");
        }

        return nuevos;
      }

      setRelacionesPadres((actual) => ({
        ...actual,
        [id]: "Tutor",
      }));

      if (!contactoPrincipal) {
        setContactoPrincipal(id);
      }

      return [...prev, id];
    });
  };

  // ==========================================
  // CAMBIAR PARENTESCO
  // ==========================================

  const cambiarParentesco = (idPadre, valor) => {
    setRelacionesPadres((prev) => ({
      ...prev,
      [String(idPadre)]: valor,
    }));
  };

  // ==========================================
  // CONSTRUIR ARREGLO DE RESPONSABLES
  // ==========================================

  const construirAsociaciones = () => {
    return padresSeleccionados.map((id) => ({
      id_padre: Number(id),
      parentesco: relacionesPadres[id] || "Tutor",
      es_contacto_principal: id === contactoPrincipal,
    }));
  };

  // ==========================================
  // VALIDAR RESPONSABLES
  // ==========================================

  const validarResponsables = () => {
    if (padresSeleccionados.length === 0) {
      return "Selecciona al menos un padre o encargado registrado.";
    }

    if (!contactoPrincipal) {
      return "Debes designar un contacto principal.";
    }

    if (!padresSeleccionados.includes(contactoPrincipal)) {
      return "El contacto principal debe estar seleccionado.";
    }

    return null;
  };

  // ==========================================
  // GUARDAR PACIENTE
  // ==========================================

  const guardarPaciente = async (e) => {
    e.preventDefault();

    if (!formulario.id_comunidad) {
      setError("Debes seleccionar una comunidad.");
      return;
    }

    const errorResponsables = validarResponsables();

    if (errorResponsables) {
      setError(errorResponsables);
      return;
    }

    if (cargandoCatalogos) {
      setError("Espera a que terminen de cargar los datos.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const datos = {
        ...formulario,
        id_comunidad: Number(formulario.id_comunidad),
        padres: construirAsociaciones(),
      };

      if (editando) {
        await api.put(
          `/pacientes/${editando.id_paciente}`,
          datos
        );

        setMensaje("Paciente actualizado correctamente.");
      } else {
        await api.post("/pacientes", datos);

        setMensaje(
          "Paciente y responsables registrados correctamente."
        );
      }

      setModal(false);
      setEditando(null);

      setFormulario({
        ...formularioInicial,
      });

      setPadresSeleccionados([]);
      setRelacionesPadres({});
      setContactoPrincipal("");

      await cargarPacientes();

    } catch (err) {
      console.error("Error al guardar paciente:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudo guardar el paciente."
      );

    } finally {
      setGuardando(false);
    }
  };

  // ==========================================
  // DESACTIVAR PACIENTE
  // ==========================================

  const desactivarPaciente = async (paciente) => {
    const confirmar = window.confirm(
      `¿Deseas desactivar a ${paciente.nombres} ${paciente.apellidos}?`
    );

    if (!confirmar) return;

    try {
      setError("");
      setMensaje("");

      await api.patch(
        `/pacientes/${paciente.id_paciente}/desactivar`
      );

      setMensaje("Paciente desactivado correctamente.");

      await cargarPacientes();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          "No se pudo desactivar el paciente."
      );
    }
  };

  // ==========================================
  // CALCULAR EDAD
  // ==========================================

  const calcularEdad = (fecha) => {
    if (!fecha) return "—";

    const nacimiento = new Date(
      `${String(fecha).substring(0, 10)}T00:00:00`
    );

    const hoy = new Date();

    let anios = hoy.getFullYear() - nacimiento.getFullYear();
    let meses = hoy.getMonth() - nacimiento.getMonth();

    if (hoy.getDate() < nacimiento.getDate()) {
      meses--;
    }

    if (meses < 0) {
      anios--;
      meses += 12;
    }

    if (anios <= 0) {
      return `${Math.max(meses, 0)} meses`;
    }

    return `${anios} años`;
  };

  // ==========================================
  // FORMATEAR FECHA
  // ==========================================

  const formatearFecha = (fecha) => {
    if (!fecha) return "—";

    const [anio, mes, dia] = String(fecha)
      .substring(0, 10)
      .split("-")
      .map(Number);

    return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT");
  };

  // ==========================================
  // PERFIL INDIVIDUAL
  // ==========================================

  if (perfilId !== null) {
    return (
      <PerfilPaciente
        id={perfilId}
        onVolver={() => setPerfilId(null)}
      />
    );
  }

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="patients-page">

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
            type="button"
            className="patients-btn patients-btn-outline"
            onClick={() => {
              cargarPacientes();
              cargarCatalogos();
            }}
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>

          <button
            type="button"
            className="patients-btn patients-btn-primary"
            onClick={abrirNuevo}
          >
            <Plus size={18} />
            Nuevo paciente
          </button>
        </div>
      </div>

      {error && (
        <div className="patients-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="patients-success">
          {mensaje}
        </div>
      )}

      {/* BUSCADOR */}

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
            <button
              type="button"
              onClick={() => setBusqueda("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* TABLA */}

      <div className="patients-table-container">
        <table className="patients-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>CUI</th>
              <th>Fecha nacimiento</th>
              <th>Edad</th>
              <th>Sexo</th>
              <th>Comunidad</th>
              <th>Encargado principal</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="9" className="patients-empty">
                  Cargando pacientes...
                </td>
              </tr>
            ) : pacientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan="9" className="patients-empty">
                  {busqueda
                    ? "No se encontraron pacientes."
                    : "Todavía no hay pacientes registrados."}
                </td>
              </tr>
            ) : (
              pacientesFiltrados.map((paciente) => {
                const principal = Array.isArray(paciente.padres)
                  ? paciente.padres.find(
                      (padre) => padre.es_contacto_principal
                    )
                  : null;

                const nombrePrincipal = principal
                  ? `${principal.nombres} ${principal.apellidos}`
                  : paciente.nombre_encargado || "—";

                return (
                  <tr key={paciente.id_paciente}>
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
                    <td>
                      {formatearFecha(paciente.fecha_nacimiento)}
                    </td>
                    <td>
                      {calcularEdad(paciente.fecha_nacimiento)}
                    </td>
                    <td>
                      {paciente.sexo === "masculino"
                        ? "Masculino"
                        : "Femenino"}
                    </td>
                    <td>
                      <span className="patients-community-cell">
                        <MapPin size={13} />
                        {paciente.comunidad_nombre || "Sin comunidad"}
                      </span>
                    </td>
                    <td>{nombrePrincipal}</td>

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

                    <td>
                      <div className="patients-actions">
                        <button
                          type="button"
                          className="patients-btn patients-btn-small"
                          title="Ver perfil"
                          onClick={() =>
                            setPerfilId(paciente.id_paciente)
                          }
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          className="patients-btn patients-btn-small"
                          title="Editar paciente"
                          onClick={() => abrirEditar(paciente)}
                        >
                          <Pencil size={15} />
                        </button>

                        {paciente.estado !== "inactivo" && (
                          <button
                            type="button"
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ======================================
          MODAL DE REGISTRO Y EDICIÓN
      ====================================== */}

      {modal && (
        <div
          className="patients-modal-overlay"
          onClick={cerrarModal}
        >
          <div
            className="patients-modal patients-modal-integrado"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="patients-modal-header">
              <div>
                <h2>
                  {editando ? "Editar paciente" : "Nuevo paciente"}
                </h2>

                <p>
                  {editando
                    ? "Actualiza los datos del paciente y sus responsables."
                    : "Completa la información del niño y selecciona sus responsables."}
                </p>
              </div>

              <button
                type="button"
                className="patients-btn"
                onClick={cerrarModal}
                disabled={guardando}
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
                    maxLength={150}
                    required
                  />
                </div>

                <div className="patients-field">
                  <label>Apellidos *</label>
                  <input
                    name="apellidos"
                    value={formulario.apellidos}
                    onChange={cambiarCampo}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="patients-field">
                  <label>Fecha de nacimiento *</label>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    value={formulario.fecha_nacimiento}
                    max={new Date(
                      Date.now() -
                      new Date().getTimezoneOffset() * 60000
                    ).toISOString().slice(0, 10)}
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
                    maxLength={13}
                    placeholder="13 dígitos"
                  />
                </div>

                <div className="patients-field">
                  <label>Comunidad *</label>
                  <select
                    name="id_comunidad"
                    value={formulario.id_comunidad}
                    onChange={cambiarCampo}
                    required
                  >
                    <option value="">
                      Selecciona una comunidad
                    </option>

                    {comunidades.map((comunidad) => (
                      <option
                        key={comunidad.id_comunidad}
                        value={comunidad.id_comunidad}
                      >
                        {comunidad.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="patients-field patients-field-full">
                  <label>Dirección</label>
                  <textarea
                    name="direccion"
                    value={formulario.direccion}
                    onChange={cambiarCampo}
                    rows={2}
                    placeholder="Dirección o referencia del domicilio"
                  />
                </div>
              </div>

              {/* PADRES Y ENCARGADOS */}

              <div className="patients-parents-section">
                <div className="patients-parents-heading">
                  <div>
                    <h3>
                      <UserPlus size={18} />
                      Padres y encargados
                    </h3>

                    <p>
                      Selecciona los responsables registrados en la comunidad.
                    </p>
                  </div>
                </div>

                {!formulario.id_comunidad ? (
                  <div className="patients-parents-empty">
                    Primero selecciona una comunidad para consultar
                    sus responsables.
                  </div>
                ) : cargandoCatalogos ? (
                  <div className="patients-parents-empty">
                    Cargando responsables...
                  </div>
                ) : padresDisponibles.length === 0 ? (
                  <div className="patients-parents-empty">
                    No hay padres activos registrados en esta comunidad.
                    <br />
                    Primero registra al responsable en el módulo
                    Padres de familia.
                  </div>
                ) : (
                  <div className="patients-parents-list">
                    {padresDisponibles.map((padre) => {
                      const id = String(padre.id_padre);
                      const seleccionado =
                        padresSeleccionados.includes(id);

                      return (
                        <div
                          key={id}
                          className={`patients-parent-option ${
                            seleccionado ? "selected" : ""
                          }`}
                        >
                          <label className="patients-parent-select">
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={() => alternarPadre(id)}
                            />

                            <span className="patients-parent-check">
                              {seleccionado && <Check size={14} />}
                            </span>

                            <span className="patients-parent-name">
                              {padre.nombres} {padre.apellidos}

                              <small>
                                {padre.telefono || "Sin teléfono registrado"}
                              </small>
                            </span>
                          </label>

                          {seleccionado && (
                            <div className="patients-parent-fields">
                              <select
                                aria-label={`Parentesco de ${padre.nombres}`}
                                value={relacionesPadres[id] || "Tutor"}
                                onChange={(e) =>
                                  cambiarParentesco(id, e.target.value)
                                }
                              >
                                <option value="Madre">Madre</option>
                                <option value="Padre">Padre</option>
                                <option value="Tutor">Tutor</option>
                                <option value="Abuela">Abuela</option>
                                <option value="Abuelo">Abuelo</option>
                                <option value="Encargado">Encargado</option>
                                <option value="Otro">Otro</option>
                              </select>

                              <label className="patients-main-contact">
                                <input
                                  type="radio"
                                  name="contacto_principal"
                                  checked={contactoPrincipal === id}
                                  onChange={() =>
                                    setContactoPrincipal(id)
                                  }
                                />
                                Contacto principal
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {padresSeleccionados.length > 0 && (
                  <div className="patients-parents-summary">
                    {padresSeleccionados.length} responsable(s) seleccionado(s).
                    {contactoPrincipal && (
                      <span>
                        {" "}Contacto principal asignado.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* PIE */}

              <div className="patients-modal-footer">
                <button
                  type="button"
                  className="patients-btn patients-btn-outline"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="patients-btn patients-btn-primary"
                  disabled={
                    guardando ||
                    cargandoCatalogos ||
                    comunidades.length === 0
                  }
                >
                  {guardando ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="patients-loading-icon"
                      />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      {editando
                        ? "Guardar cambios"
                        : "Registrar paciente"}
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
