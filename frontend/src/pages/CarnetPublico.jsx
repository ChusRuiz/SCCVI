import { useMemo, useState } from "react";
import {
  Activity,
  Baby,
  CalendarDays,
  CheckCircle2,
  LockKeyhole,
  MapPin,
  Printer,
  ShieldCheck,
  Syringe,
  UnlockKeyhole,
} from "lucide-react";
import api from "../services/api";

function formatearFecha(valor) {
  if (!valor) return "No registrada";

  const fechaTexto = String(valor);
  const fecha = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)
      ? `${fechaTexto}T12:00:00`
      : fechaTexto
  );

  if (Number.isNaN(fecha.getTime())) return "No registrada";

  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function mostrarNumero(valor, unidad) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return `${Number(valor).toLocaleString("es-GT", {
    maximumFractionDigits: 2,
  })} ${unidad}`;
}

export default function CarnetPublico({ token }) {
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [carnet, setCarnet] = useState(null);

  const vacunaciones = useMemo(
    () => carnet?.vacunaciones || [],
    [carnet]
  );
  const controles = useMemo(
    () => carnet?.controles_crecimiento || [],
    [carnet]
  );

  const validarAcceso = async (event) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6,12}$/.test(pin)) {
      setError("Ingresa un PIN de entre 6 y 12 dígitos.");
      return;
    }

    setCargando(true);

    try {
      const respuesta = await api.post("/carnets/acceso", {
        token,
        pin,
      });

      if (!respuesta.data?.success) {
        throw new Error("No fue posible validar el carnet.");
      }

      setCarnet(respuesta.data);
      setPin("");
    } catch (err) {
      const status = err.response?.status;

      if (status === 429) {
        setError(
          "El acceso está temporalmente bloqueado por seguridad. Inténtalo nuevamente después de 15 minutos."
        );
      } else if (status === 400 || status === 401) {
        setError(
          "No fue posible validar el carnet y el PIN. Verifica los datos e inténtalo nuevamente."
        );
      } else if (!err.response) {
        setError(
          "No se pudo conectar con SCCVI. Comprueba tu conexión e inténtalo nuevamente."
        );
      } else {
        setError(
          err.response.data?.mensaje ||
            "Ocurrió un error al consultar el carnet. Inténtalo más tarde."
        );
      }
    } finally {
      setCargando(false);
    }
  };

  const bloquearVista = () => {
    setCarnet(null);
    setPin("");
    setError("");
  };

  if (!carnet) {
    return (
      <main className="carnet-public-page">
        <section className="carnet-access-card" aria-labelledby="carnet-access-title">
          <div className="carnet-brand">
            <div className="carnet-brand-icon">
              <Baby size={25} />
            </div>
            <div>
              <strong>SCCVI</strong>
              <span>Control de crecimiento y vacunación infantil</span>
            </div>
          </div>

          <div className="carnet-access-icon">
            <LockKeyhole size={30} />
          </div>

          <p className="carnet-eyebrow">CARNET DIGITAL INFANTIL</p>
          <h1 id="carnet-access-title">Acceso protegido</h1>
          <p className="carnet-access-description">
            Ingresa el PIN entregado por el centro de salud para consultar el
            carnet digital.
          </p>

          <form className="carnet-pin-form" onSubmit={validarAcceso}>
            <label htmlFor="carnet-pin">PIN de seguridad</label>
            <input
              id="carnet-pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Ingresa tu PIN"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 12));
                if (error) setError("");
              }}
              minLength={6}
              maxLength={12}
              required
              aria-describedby={error ? "carnet-error" : "carnet-pin-help"}
            />
            <small id="carnet-pin-help">De 6 a 12 dígitos numéricos.</small>

            {error && (
              <div className="carnet-error" id="carnet-error" role="alert">
                {error}
              </div>
            )}

            <button className="carnet-primary-button" type="submit" disabled={cargando}>
              {cargando ? "Verificando..." : "Consultar carnet"}
              {!cargando && <UnlockKeyhole size={17} />}
            </button>
          </form>

          <div className="carnet-security-note">
            <ShieldCheck size={17} />
            <span>Tu información está protegida. No compartas tu PIN.</span>
          </div>
        </section>
        <footer className="carnet-public-footer">
          Sistema de Control de Crecimiento y Vacunación Infantil · SCCVI
        </footer>
      </main>
    );
  }

  const paciente = carnet.paciente || {};

  return (
    <main className="carnet-public-page carnet-public-page-open">
      <header className="carnet-public-header">
        <div className="carnet-brand">
          <div className="carnet-brand-icon">
            <Baby size={25} />
          </div>
          <div>
            <strong>SCCVI</strong>
            <span>Carnet digital infantil</span>
          </div>
        </div>
        <div className="carnet-header-actions">
          <span className="carnet-verified-label">
            <CheckCircle2 size={16} /> Acceso verificado
          </span>
          <button
            type="button"
            className="carnet-outline-button carnet-print-button"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Imprimir
          </button>
          <button
            type="button"
            className="carnet-outline-button"
            onClick={bloquearVista}
          >
            <LockKeyhole size={16} /> Bloquear
          </button>
        </div>
      </header>

      <section className="carnet-content">
        <div className="carnet-title-block">
          <p className="carnet-eyebrow">EXPEDIENTE INFANTIL</p>
          <h1>Carnet de crecimiento y vacunación</h1>
          <p>Información consultada de forma segura desde SCCVI.</p>
        </div>

        <section className="carnet-patient-card">
          <div className="carnet-patient-avatar"><Baby size={30} /></div>
          <div className="carnet-patient-main">
            <span>Nombre del niño o niña</span>
            <h2>{[paciente.nombres, paciente.apellidos].filter(Boolean).join(" ") || "Sin nombre"}</h2>
            <div className="carnet-patient-meta">
              <span><CalendarDays size={15} /> {formatearFecha(paciente.fecha_nacimiento)}</span>
              {paciente.sexo && <span>{paciente.sexo}</span>}
              {paciente.comunidad && <span><MapPin size={15} /> {paciente.comunidad}</span>}
            </div>
          </div>
          <div className="carnet-active-mark"><CheckCircle2 size={16} /> Carnet válido</div>
        </section>

        <div className="carnet-section-heading">
          <div>
            <span className="carnet-section-kicker">REGISTROS</span>
            <h2>Historial del paciente</h2>
          </div>
          <span className="carnet-data-count">
            {vacunaciones.length} vacunas · {controles.length} controles
          </span>
        </div>

        <section className="carnet-record-grid">
          <article className="carnet-record-card">
            <div className="carnet-record-title">
              <div className="carnet-record-icon vaccine"><Syringe size={19} /></div>
              <div>
                <h3>Vacunaciones</h3>
                <p>Historial de dosis aplicadas</p>
              </div>
            </div>

            {vacunaciones.length === 0 ? (
              <div className="carnet-empty-state">No hay vacunaciones registradas.</div>
            ) : (
              <div className="carnet-table-wrap">
                <table className="carnet-table">
                  <thead>
                    <tr>
                      <th>Vacuna</th>
                      <th>Dosis</th>
                      <th>Fecha aplicada</th>
                      <th>Próxima dosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacunaciones.map((vacuna, index) => (
                      <tr key={vacuna.id_vacunacion || `${vacuna.vacuna}-${index}`}>
                        <td>{vacuna.vacuna || "Vacuna"}</td>
                        <td>{vacuna.dosis || "—"}</td>
                        <td>{formatearFecha(vacuna.fecha_aplicacion)}</td>
                        <td>{formatearFecha(vacuna.proxima_dosis)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="carnet-record-card">
            <div className="carnet-record-title">
              <div className="carnet-record-icon growth"><Activity size={19} /></div>
              <div>
                <h3>Controles de crecimiento</h3>
                <p>Últimas mediciones registradas</p>
              </div>
            </div>

            {controles.length === 0 ? (
              <div className="carnet-empty-state">No hay controles de crecimiento registrados.</div>
            ) : (
              <div className="carnet-growth-list">
                {controles.map((control, index) => (
                  <div className="carnet-growth-item" key={`${control.fecha_control}-${index}`}>
                    <div className="carnet-growth-date">
                      <CalendarDays size={15} />
                      {formatearFecha(control.fecha_control)}
                    </div>
                    <div className="carnet-growth-values">
                      <span><strong>{mostrarNumero(control.peso_kg, "kg")}</strong><small>Peso</small></span>
                      <span><strong>{mostrarNumero(control.talla_cm, "cm")}</strong><small>Talla</small></span>
                      <span><strong>{mostrarNumero(control.perimetro_cefalico_cm, "cm")}</strong><small>Perímetro cefálico</small></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <div className="carnet-disclaimer">
          <ShieldCheck size={18} />
          <p>
            Este carnet presenta registros disponibles en SCCVI. Para correcciones,
            aclaraciones o una valoración de salud, comunícate con el personal del centro de salud.
          </p>
        </div>
      </section>

      <footer className="carnet-public-footer">
        Sistema de Control de Crecimiento y Vacunación Infantil · SCCVI
      </footer>
    </main>
  );
}
