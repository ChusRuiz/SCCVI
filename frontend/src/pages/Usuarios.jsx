import { useEffect, useMemo, useState } from "react";
import { Edit3, UserPlus, Users, Power, X, Save, Search, ShieldCheck } from "lucide-react";
import api from "../services/api";
import { ETIQUETAS_ROL } from "../utils/rolesSccvi";
import "../styles/usuarios.css";

const FORM_VACIO = {
  nombre: "",
  correo: "",
  rol: "personal_salud",
  password: "",
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [rolFiltro, setRolFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargarUsuarios = async () => {
    setCargando(true);
    setError("");
    try {
      const { data } = await api.get("/usuarios");
      setUsuarios(data.usuarios || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const coincideTexto = !texto ||
        `${usuario.nombre} ${usuario.correo}`.toLowerCase().includes(texto);
      const coincideRol = rolFiltro === "todos" || usuario.rol === rolFiltro;
      const coincideEstado = estadoFiltro === "todos" ||
        (estadoFiltro === "activo" ? usuario.estado === true : usuario.estado === false);
      return coincideTexto && coincideRol && coincideEstado;
    });
  }, [usuarios, busqueda, rolFiltro, estadoFiltro]);

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario(FORM_VACIO);
    setError("");
    setMensaje("");
    setModalAbierto(true);
  };

  const abrirEdicion = (usuario) => {
    setEditando(usuario.id_usuario);
    setFormulario({
      nombre: usuario.nombre || "",
      correo: usuario.correo || "",
      rol: usuario.rol,
      password: "",
    });
    setError("");
    setMensaje("");
    setModalAbierto(true);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      if (editando) {
        await api.put(`/usuarios/${editando}`, formulario);
        setMensaje("Usuario actualizado correctamente.");
      } else {
        await api.post("/usuarios", formulario);
        setMensaje("Usuario creado correctamente.");
      }
      setModalAbierto(false);
      setFormulario(FORM_VACIO);
      setEditando(null);
      await cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo guardar el usuario.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (usuario) => {
    const nuevoEstado = !usuario.estado;
    const accion = nuevoEstado ? "activar" : "desactivar";
    if (!window.confirm(`¿Deseas ${accion} la cuenta de ${usuario.nombre}?`)) return;
    setError("");
    setMensaje("");
    try {
      await api.patch(`/usuarios/${usuario.id_usuario}/estado`, { estado: nuevoEstado });
      setMensaje(`Cuenta ${nuevoEstado ? "activada" : "desactivada"} correctamente.`);
      await cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.mensaje || `No se pudo ${accion} la cuenta.`);
    }
  };

  return (
    <section className="users-page">
      <div className="users-page-heading">
        <div>
          <span className="users-eyebrow">ADMINISTRACIÓN</span>
          <h2>Usuarios y roles</h2>
          <p>Administra las cuentas del personal autorizado para utilizar SCCVI.</p>
        </div>
        <button className="users-primary-button" onClick={abrirNuevo}>
          <UserPlus size={17} /> Nuevo usuario
        </button>
      </div>

      <div className="users-role-summary">
        <div><ShieldCheck size={20} /><span>Administrador</span><strong>{usuarios.filter(u => u.rol === "admin").length}</strong></div>
        <div><Users size={20} /><span>Personal de salud</span><strong>{usuarios.filter(u => u.rol === "personal_salud").length}</strong></div>
        <div><Users size={20} /><span>Encargado del centro</span><strong>{usuarios.filter(u => u.rol === "encargado_centro").length}</strong></div>
      </div>

      {mensaje && <div className="users-feedback success">{mensaje}</div>}
      {error && !modalAbierto && <div className="users-feedback error">{error}</div>}

      <div className="users-table-card">
        <div className="users-filters">
          <label className="users-search"><Search size={17}/><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo..."/></label>
          <select value={rolFiltro} onChange={e => setRolFiltro(e.target.value)}>
            <option value="todos">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="personal_salud">Personal de salud</option>
            <option value="encargado_centro">Encargado del centro</option>
          </select>
          <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>

        {cargando ? (
          <div className="users-empty">Cargando usuarios...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="users-empty">No se encontraron usuarios.</div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {usuariosFiltrados.map(usuario => (
                  <tr key={usuario.id_usuario}>
                    <td><strong>{usuario.nombre}</strong><small>ID #{usuario.id_usuario}</small></td>
                    <td>{usuario.correo}</td>
                    <td><span className={`users-role-badge role-${usuario.rol}`}>{ETIQUETAS_ROL[usuario.rol]}</span></td>
                    <td><span className={`users-status ${usuario.estado ? "active" : "inactive"}`}>{usuario.estado ? "Activo" : "Inactivo"}</span></td>
                    <td>
                      <div className="users-row-actions">
                        <button type="button" title="Editar usuario" onClick={() => abrirEdicion(usuario)}><Edit3 size={16}/></button>
                        <button type="button" title={usuario.estado ? "Desactivar" : "Activar"} onClick={() => cambiarEstado(usuario)}><Power size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="users-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalAbierto(false); }}>
          <div className="users-modal">
            <div className="users-modal-heading">
              <div><span className="users-eyebrow">CUENTAS DEL SISTEMA</span><h3>{editando ? "Editar usuario" : "Registrar usuario"}</h3></div>
              <button type="button" onClick={() => setModalAbierto(false)}><X size={19}/></button>
            </div>
            <form onSubmit={guardarUsuario}>
              <label>Nombre completo<input value={formulario.nombre} onChange={e => setFormulario({...formulario, nombre:e.target.value})} maxLength={150} required/></label>
              <label>Correo electrónico<input type="email" value={formulario.correo} onChange={e => setFormulario({...formulario, correo:e.target.value})} maxLength={150} required/></label>
              <label>Rol<select value={formulario.rol} onChange={e => setFormulario({...formulario, rol:e.target.value})}>
                <option value="admin">Administrador del sistema</option>
                <option value="personal_salud">Personal de salud</option>
                <option value="encargado_centro">Encargado del centro de salud</option>
              </select></label>
              <label>{editando ? "Nueva contraseña (opcional)" : "Contraseña inicial"}<input type="password" value={formulario.password} onChange={e => setFormulario({...formulario, password:e.target.value})} minLength={editando ? 0 : 8} autoComplete="new-password" required={!editando} placeholder={editando ? "Dejar en blanco para conservar" : "Mínimo 8 caracteres"}/></label>
              {error && <div className="users-feedback error">{error}</div>}
              <div className="users-modal-actions">
                <button type="button" className="users-secondary-button" onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" className="users-primary-button" disabled={guardando}><Save size={16}/>{guardando ? "Guardando..." : "Guardar usuario"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
