
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Search,
  Plus,
  Pencil,
  RefreshCw,
  X,
  Users,
  UserRound,
  MapPinned,
  Building2,
  CheckCircle2,
  CircleOff,
} from "lucide-react";

import api from "../services/api";

const formularioInicial = {
  nombre: "",
  ubicacion: "",
  familias_estimadas: "0",
};

export default function Comunidades() {
  const [comunidades, setComunidades] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todas");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState({
    ...formularioInicial,
  });

  // ============================================
  // CARGAR COMUNIDADES
  // ============================================

  const cargarComunidades = async (filtros = {}) => {
    try {
      setCargando(true);
      setError("");

      const response = await api.get("/comunidades", {
        params: {
          buscar: filtros.buscar ?? busqueda,
          estado: filtros.estado ?? estado,
        },
      });

      const datos = Array.isArray(response.data)
        ? response.data
        : response.data.comunidades || [];

      setComunidades(datos);
    } catch (err) {
      console.error("Error al cargar comunidades:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar las comunidades."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarComunidades({
      buscar: "",
      estado: "todas",
    });
  }, []);

  // ============================================
  // RESUMEN
  // ============================================

  const resumen = useMemo(() => {
    return {
      total: comunidades.length,

      activas: comunidades.filter(
        (comunidad) => comunidad.estado === "activa"
      ).length,

      familias: comunidades.reduce(
        (total, comunidad) =>
          total + Number(comunidad.familias_estimadas || 0),
        0
      ),

      pacientes: comunidades.reduce(
        (total, comunidad) =>
          total + Number(comunidad.total_pacientes || 0),
        0
      ),
    };
  }, [comunidades]);

  // ============================================
  // BUSCAR
  // ============================================

  const buscarComunidades = (e) => {
    e.preventDefault();

    cargarComunidades({
      buscar: busqueda,
      estado,
    });
  };

  const cambiarEstadoFiltro = (e) => {
    const nuevoEstado = e.target.value;

    setEstado(nuevoEstado);

    cargarComunidades({
      buscar: busqueda,
      estado: nuevoEstado,
    });
  };

  const limpiarBusqueda = () => {
    setBusqueda("");

    cargarComunidades({
      buscar: "",
      estado,
    });
  };

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

  const abrirNueva = () => {
    setEditando(null);
    setFormulario({ ...formularioInicial });
    setError("");
    setMensaje("");
    setModal(true);
  };

  const abrirEdicion = (comunidad) => {
    setEditando(comunidad);

    setFormulario({
      nombre: comunidad.nombre || "",
      ubicacion: comunidad.ubicacion || "",
      familias_estimadas: String(
        comunidad.familias_estimadas ?? 0
      ),
    });

    setError("");
    setMensaje("");
    setModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setModal(false);
    setEditando(null);
    setFormulario({ ...formularioInicial });
  };

  // ============================================
  // GUARDAR COMUNIDAD
  // ============================================

  const guardarComunidad = async (e) => {
    e.preventDefault();

    const familias = Number(formulario.familias_estimadas);

    if (!formulario.nombre.trim()) {
      setError("El nombre de la comunidad es obligatorio.");
      return;
    }

    if (!formulario.ubicacion.trim()) {
      setError("La ubicación de la comunidad es obligatoria.");
      return;
    }

    if (!Number.isInteger(familias) || familias < 0) {
      setError(
        "El número estimado de familias debe ser un entero mayor o igual a cero."
      );
      return;
    }

    const datos = {
      nombre: formulario.nombre.trim(),
      ubicacion: formulario.ubicacion.trim(),
      familias_estimadas: familias,
    };

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (editando) {
        await api.put(
          `/comunidades/${editando.id_comunidad}`,
          datos
        );

        setMensaje("Comunidad actualizada correctamente.");
      } else {
        await api.post("/comunidades", datos);

        setMensaje("Comunidad registrada correctamente.");
      }

      setModal(false);
      setEditando(null);
      setFormulario({ ...formularioInicial });

      await cargarComunidades();
    } catch (err) {
      console.error("Error al guardar comunidad:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudo guardar la comunidad."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ============================================
  // CAMBIAR ESTADO
  // ============================================

  const cambiarEstadoComunidad = async (comunidad) => {
    const estaActiva = comunidad.estado === "activa";

    const accion = estaActiva ? "desactivar" : "reactivar";

    const confirmar = window.confirm(
      `¿Deseas ${accion} la comunidad "${comunidad.nombre}"?`
    );

    if (!confirmar) return;

    try {
      setError("");
      setMensaje("");

      if (estaActiva) {
        await api.patch(
          `/comunidades/${comunidad.id_comunidad}/desactivar`
        );

        setMensaje("Comunidad desactivada correctamente.");
      } else {
        await api.patch(
          `/comunidades/${comunidad.id_comunidad}/activar`
        );

        setMensaje("Comunidad reactivada correctamente.");
      }

      await cargarComunidades();
    } catch (err) {
      console.error("Error al cambiar estado:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudo actualizar el estado de la comunidad."
      );
    }
  };

  // ============================================
  // RENDERIZADO
  // ============================================

  return (
    <div className="communities-page">

      {/* ENCABEZADO */}

      <div className="communities-header">
        <div>
          <div className="communities-title">
            <MapPinned size={24} />
            <h1>Comunidades</h1>
          </div>

          <p>
            Administra las comunidades y localidades asociadas al centro
            de salud.
          </p>
        </div>

        <div className="communities-header-actions">
          <button
            type="button"
            className="communities-btn communities-btn-outline"
            onClick={() => cargarComunidades()}
            disabled={cargando}
            title="Actualizar"
          >
            <RefreshCw
              size={17}
              className={cargando ? "communities-spin" : ""}
            />
          </button>

          <button
            type="button"
            className="communities-btn communities-btn-primary"
            onClick={abrirNueva}
          >
            <Plus size={18} />
            Nueva comunidad
          </button>
        </div>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="communities-alert communities-alert-error">
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
        <div className="communities-alert communities-alert-success">
          <CheckCircle2 size={17} />
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

      {/* TARJETAS DE RESUMEN */}

      <div className="communities-stats">

        <div className="communities-stat-card">
          <div className="communities-stat-icon">
            <Building2 size={21} />
          </div>

          <div>
            <span>Total de comunidades</span>
            <strong>{resumen.total}</strong>
          </div>
        </div>

        <div className="communities-stat-card">
          <div className="communities-stat-icon stat-icon-green">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Comunidades activas</span>
            <strong>{resumen.activas}</strong>
          </div>
        </div>

        <div className="communities-stat-card">
          <div className="communities-stat-icon stat-icon-blue">
            <Users size={21} />
          </div>

          <div>
            <span>Familias estimadas</span>
            <strong>{resumen.familias.toLocaleString("es-GT")}</strong>
          </div>
        </div>

        <div className="communities-stat-card">
          <div className="communities-stat-icon stat-icon-purple">
            <UserRound size={21} />
          </div>

          <div>
            <span>Pacientes asociados</span>
            <strong>{resumen.pacientes}</strong>
          </div>
        </div>

      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}

      <div className="communities-toolbar">
        <form
          className="communities-search"
          onSubmit={buscarComunidades}
        >
          <Search size={18} />

          <input
            type="search"
            placeholder="Buscar por nombre o ubicación..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {busqueda && (
            <button
              type="button"
              onClick={limpiarBusqueda}
              aria-label="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="submit"
            className="communities-search-submit"
            title="Buscar"
          >
            Buscar
          </button>
        </form>

        <div className="communities-filter">
          <label htmlFor="filtro-comunidad">Estado</label>

          <select
            id="filtro-comunidad"
            value={estado}
            onChange={cambiarEstadoFiltro}
          >
            <option value="todas">Todas</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>
        </div>
      </div>

      {/* TABLA */}

      <div className="communities-table-container">
        <div className="communities-table-heading">
          <div>
            <h2>Listado de comunidades</h2>
            <p>
              {comunidades.length} registros encontrados
            </p>
          </div>

          <MapPin size={21} />
        </div>

        {cargando ? (
          <div className="communities-empty">
            <RefreshCw size={25} className="communities-spin" />
            <strong>Cargando comunidades...</strong>
          </div>
        ) : comunidades.length === 0 ? (
          <div className="communities-empty">
            <MapPin size={30} />

            <strong>No hay comunidades registradas</strong>

            <p>
              Registra una comunidad para comenzar a organizar los
              pacientes del sistema.
            </p>

            <button
              type="button"
              className="communities-btn communities-btn-primary"
              onClick={abrirNueva}
            >
              <Plus size={16} />
              Registrar comunidad
            </button>
          </div>
        ) : (
          <div className="communities-table-scroll">
            <table className="communities-table">
              <thead>
                <tr>
                  <th>Comunidad</th>
                  <th>Ubicación</th>
                  <th>Familias estimadas</th>
                  <th>Pacientes</th>
                  <th>Padres</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {comunidades.map((comunidad) => {
                  const activa = comunidad.estado === "activa";

                  return (
                    <tr key={comunidad.id_comunidad}>
                      <td>
                        <div className="communities-name-cell">
                          <div className="communities-row-icon">
                            <MapPin size={17} />
                          </div>

                          <div>
                            <strong>{comunidad.nombre}</strong>

                            <span>
                              ID #{comunidad.id_comunidad}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="communities-location">
                        {comunidad.ubicacion}
                      </td>

                      <td>
                        {Number(
                          comunidad.familias_estimadas || 0
                        ).toLocaleString("es-GT")}
                      </td>

                      <td>
                        <span className="communities-count">
                          <UserRound size={14} />
                          {Number(comunidad.total_pacientes || 0)}
                        </span>
                      </td>

                      <td>
                        <span className="communities-count">
                          <Users size={14} />
                          {Number(comunidad.total_padres || 0)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`communities-status ${
                            activa ? "active" : "inactive"
                          }`}
                        >
                          {activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>

                      <td>
                        <div className="communities-actions">
                          <button
                            type="button"
                            className="communities-action-btn"
                            onClick={() => abrirEdicion(comunidad)}
                            title="Editar comunidad"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className={`communities-action-btn ${
                              activa ? "action-danger" : "action-success"
                            }`}
                            onClick={() =>
                              cambiarEstadoComunidad(comunidad)
                            }
                            title={
                              activa
                                ? "Desactivar comunidad"
                                : "Reactivar comunidad"
                            }
                          >
                            {activa ? (
                              <CircleOff size={16} />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================
          MODAL DE REGISTRO Y EDICIÓN
      ====================================== */}

      {modal && (
        <div
          className="communities-modal-overlay"
          onClick={cerrarModal}
        >
          <div
            className="communities-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="communities-modal-header">
              <div>
                <div className="communities-modal-icon">
                  <MapPinned size={22} />
                </div>

                <h2>
                  {editando
                    ? "Editar comunidad"
                    : "Registrar comunidad"}
                </h2>

                <p>
                  Ingresa la información de la comunidad o localidad.
                </p>
              </div>

              <button
                type="button"
                className="communities-action-btn"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar formulario"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={guardarComunidad}>
              <div className="communities-form-grid">

                <div className="communities-field communities-field-full">
                  <label htmlFor="comunidad-nombre">
                    Nombre de la comunidad *
                  </label>

                  <input
                    id="comunidad-nombre"
                    type="text"
                    name="nombre"
                    value={formulario.nombre}
                    onChange={cambiarCampo}
                    maxLength={120}
                    placeholder="Ej. Comunidad El Terrero"
                    required
                  />
                </div>

                <div className="communities-field communities-field-full">
                  <label htmlFor="comunidad-ubicacion">
                    Ubicación *
                  </label>

                  <textarea
                    id="comunidad-ubicacion"
                    name="ubicacion"
                    value={formulario.ubicacion}
                    onChange={cambiarCampo}
                    rows={3}
                    placeholder="Ej. Municipio, departamento y referencias de ubicación"
                    required
                  />
                </div>

                <div className="communities-field communities-field-full">
                  <label htmlFor="comunidad-familias">
                    Número estimado de familias *
                  </label>

                  <input
                    id="comunidad-familias"
                    type="number"
                    name="familias_estimadas"
                    value={formulario.familias_estimadas}
                    onChange={cambiarCampo}
                    min="0"
                    step="1"
                    placeholder="Ej. 50"
                    required
                  />

                  <small>
                    Ingresa una estimación de las familias que pertenecen
                    a esta comunidad.
                  </small>
                </div>

              </div>

              <div className="communities-modal-footer">
                <button
                  type="button"
                  className="communities-btn communities-btn-outline"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="communities-btn communities-btn-primary"
                  disabled={guardando}
                >
                  {guardando ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="communities-spin"
                      />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      {editando ? "Guardar cambios" : "Registrar comunidad"}
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
