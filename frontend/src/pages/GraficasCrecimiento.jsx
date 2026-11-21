import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Activity, RefreshCw, Info } from "lucide-react";

import api from "../services/api";
import { formatearPercentil, percentilDesdeZ } from "../utils/percentilesOms";

const SERIES_OMS = [
  { key: "z_menos_3", nombre: "P0.1 (-3 Z)", color: "#d97736" },
  { key: "z_menos_2", nombre: "P2.3 (-2 Z)", color: "#e6a23c" },
  { key: "z_menos_1", nombre: "P15.9 (-1 Z)", color: "#94a3b8" },
  { key: "z_0", nombre: "P50 (0 Z)", color: "#14b8a6", grosor: 3 },
  { key: "z_mas_1", nombre: "P84.1 (+1 Z)", color: "#94a3b8" },
  { key: "z_mas_2", nombre: "P97.7 (+2 Z)", color: "#e6a23c" },
  { key: "z_mas_3", nombre: "P99.9 (+3 Z)", color: "#d97736" },
];

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function fechaTexto(valor) {
  if (!valor) return "Sin fecha";
  const [anio, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return "Sin fecha";
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT");
}

function obtenerEvaluacion(control, indicador) {
  const evaluaciones = control?.evaluaciones_oms;
  if (!evaluaciones) return null;
  if (Array.isArray(evaluaciones)) {
    return evaluaciones.find((item) => item.indicador === indicador) || null;
  }
  if (typeof evaluaciones === "string") {
    try {
      const parsed = JSON.parse(evaluaciones);
      return parsed[indicador] || null;
    } catch {
      return null;
    }
  }
  return evaluaciones[indicador] || null;
}

function prepararReferencias(filas = []) {
  if (!filas.length) return [];

  const usaEdad = filas[0].edad_meses !== undefined && filas[0].edad_meses !== null;
  const campoX = usaEdad ? "edad_meses" : "medida_cm";

  return filas
    .map((fila) => ({
      x: numero(fila[campoX]),
      z_menos_3: numero(fila.z_menos_3),
      z_menos_2: numero(fila.z_menos_2),
      z_menos_1: numero(fila.z_menos_1),
      z_0: numero(fila.z_0),
      z_mas_1: numero(fila.z_mas_1),
      z_mas_2: numero(fila.z_mas_2),
      z_mas_3: numero(fila.z_mas_3),
    }))
    .filter((fila) => fila.x !== null && SERIES_OMS.every((serie) => fila[serie.key] !== null))
    .sort((a, b) => a.x - b.x);
}

function prepararMediciones(controles, indicador, obtenerX, obtenerY) {
  return (controles || [])
    .map((control) => {
      const x = numero(obtenerX(control));
      const y = numero(obtenerY(control));
      if (x === null || y === null) return null;

      const evaluacion = obtenerEvaluacion(control, indicador);
      const z = numero(evaluacion?.puntuacion_z);

      return {
        x,
        y,
        fecha: fechaTexto(control.fecha_control),
        id_control: control.id_control,
        puntuacion_z: z,
        percentil: z === null ? null : percentilDesdeZ(z),
        estado: evaluacion?.estado || null,
        descripcion: evaluacion?.descripcion || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);
}

function LeyendaOMS() {
  return (
    <div className="growth-oms-legend">
      <div className="growth-oms-legend-item">
        <span className="growth-oms-patient-dot" />
        <span>Mediciones del paciente</span>
      </div>
      <div className="growth-oms-legend-item">
        <span className="growth-oms-line growth-oms-median-line" />
        <span>Referencias OMS</span>
      </div>
      <div className="growth-oms-z-legend">
        {SERIES_OMS.map((serie) => (
          <span key={serie.key} style={{ color: serie.color }}>{serie.nombre}</span>
        ))}
      </div>
    </div>
  );
}

function TooltipOMS({ active, payload, label, unidad, etiquetaX }) {
  if (!active || !payload?.length) return null;

  const puntoPaciente = payload
    .map((item) => item.payload)
    .find((item) => item && item.id_control !== undefined);

  const lineas = payload.filter((item) => SERIES_OMS.some((serie) => serie.key === item.dataKey));

  return (
    <div className="growth-oms-tooltip">
      <strong>{etiquetaX}: {Number(label).toFixed(1)}</strong>

      {puntoPaciente ? (
        <div className="growth-oms-tooltip-patient">
          <div><strong>Paciente · {puntoPaciente.fecha}</strong></div>
          <div>Medición: {Number(puntoPaciente.y).toFixed(2)} {unidad}</div>
          <div>
            Puntuación Z: {puntoPaciente.puntuacion_z === null ? "No disponible" : puntoPaciente.puntuacion_z.toFixed(4)}
          </div>
          <div>
            Percentil aproximado: {puntoPaciente.percentil === null ? "No disponible" : formatearPercentil(puntoPaciente.puntuacion_z)}
          </div>
          {puntoPaciente.descripcion && <small>{puntoPaciente.descripcion}</small>}
          {puntoPaciente.percentil === null && (
            <small>Este control no tiene una evaluación OMS almacenada para este indicador.</small>
          )}
        </div>
      ) : (
        lineas.map((item) => (
          <div className="growth-oms-tooltip-row" key={item.dataKey}>
            <span className="growth-oms-tooltip-dot" style={{ background: item.color }} />
            <span>{item.name || item.dataKey}:</span>
            <strong>{Number(item.value).toFixed(2)} {unidad}</strong>
          </div>
        ))
      )}
    </div>
  );
}

function CurvaOMS({
  titulo,
  descripcion,
  unidad,
  etiquetaX,
  referencias,
  mediciones,
  controlesExcluidos = 0,
}) {
  const datosReferencia = useMemo(() => prepararReferencias(referencias), [referencias]);

  if (!datosReferencia.length) {
    return (
      <section className="growth-chart-card growth-oms-chart-card">
        <h3>{titulo}</h3>
        <div className="growth-empty-chart">No hay referencias OMS disponibles para esta gráfica.</div>
      </section>
    );
  }

  return (
    <section className="growth-chart-card growth-oms-chart-card">
      <div className="growth-chart-header">
        <div>
          <h3>{titulo}</h3>
          <p>{descripcion}</p>
        </div>
        <span>{unidad}</span>
      </div>

      <LeyendaOMS />

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={datosReferencia}
          margin={{ top: 15, right: 20, bottom: 28, left: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />

          <XAxis
            type="number"
            dataKey="x"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            stroke="var(--border)"
            label={{
              value: etiquetaX,
              position: "insideBottom",
              offset: -17,
              fill: "var(--text-secondary)",
              fontSize: 11,
            }}
          />

          <YAxis
            type="number"
            domain={["auto", "auto"]}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            stroke="var(--border)"
            width={55}
            label={{
              value: unidad,
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-secondary)",
              fontSize: 11,
            }}
          />

          <Tooltip
            content={<TooltipOMS unidad={unidad} etiquetaX={etiquetaX} />}
            isAnimationActive={false}
          />

          {SERIES_OMS.map((serie) => (
            <Line
              key={serie.key}
              type="monotone"
              dataKey={serie.key}
              name={serie.nombre}
              stroke={serie.color}
              strokeWidth={serie.grosor || 1.6}
              strokeDasharray={serie.key === "z_0" ? undefined : "5 4"}
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}

          <Scatter
            name="Paciente"
            data={mediciones}
            dataKey="y"
            fill="#0f766e"
            shape="circle"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="growth-curve-footer">
        <span>{mediciones.length} mediciones incluidas</span>
        {controlesExcluidos > 0 && (
          <span className="growth-curve-excluded">
            {controlesExcluidos} control(es) excluido(s): falta método o talla estandarizada
          </span>
        )}
      </div>
    </section>
  );
}

export default function GraficasCrecimiento({ pacienteId }) {
  const [datosOMS, setDatosOMS] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargarCurvas = async () => {
    if (!pacienteId) return;

    try {
      setCargando(true);
      setError("");
      const response = await api.get(`/crecimiento/paciente/${pacienteId}/curvas-oms`);
      setDatosOMS(response.data);
    } catch (err) {
      console.error("Error al cargar curvas OMS:", err);
      setError(err.response?.data?.mensaje || "No se pudieron cargar las curvas OMS.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let vigente = true;

    async function consultar() {
      if (!pacienteId) {
        setDatosOMS(null);
        return;
      }

      try {
        setCargando(true);
        setError("");
        setDatosOMS(null);
        const response = await api.get(`/crecimiento/paciente/${pacienteId}/curvas-oms`);
        if (vigente) setDatosOMS(response.data);
      } catch (err) {
        console.error("Error al cargar curvas OMS:", err);
        if (vigente) {
          setError(err.response?.data?.mensaje || "No se pudieron cargar las curvas OMS.");
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    consultar();
    return () => { vigente = false; };
  }, [pacienteId]);

  const controles = datosOMS?.controles || [];
  const curvas = datosOMS?.curvas || {};

  const pesoEdad = useMemo(
    () => prepararMediciones(controles, "peso_edad", (c) => c.edad_meses, (c) => c.peso_kg),
    [datosOMS]
  );

  const tallaEdad = useMemo(
    () => prepararMediciones(controles, "talla_edad", (c) => c.edad_meses, (c) => c.talla_estandar_oms_cm),
    [datosOMS]
  );

  const menoresDos = controles.filter((c) => Number(c.edad_meses) < 24);
  const desdeDos = controles.filter((c) => Number(c.edad_meses) >= 24);

  const pesoLongitud = useMemo(
    () => prepararMediciones(menoresDos, "peso_talla", (c) => c.talla_estandar_oms_cm, (c) => c.peso_kg),
    [datosOMS]
  );

  const pesoEstatura = useMemo(
    () => prepararMediciones(desdeDos, "peso_talla", (c) => c.talla_estandar_oms_cm, (c) => c.peso_kg),
    [datosOMS]
  );

  const perimetroEdad = useMemo(
    () => prepararMediciones(controles, "perimetro_cefalico", (c) => c.edad_meses, (c) => c.perimetro_cefalico_cm),
    [datosOMS]
  );

  const controlesSinTalla = Number(datosOMS?.controles_sin_talla_estandarizada || 0);
  const sinTallaMenores = menoresDos.filter((c) => numero(c.talla_estandar_oms_cm) === null).length;
  const sinTallaMayores = desdeDos.filter((c) => numero(c.talla_estandar_oms_cm) === null).length;

  if (!pacienteId) {
    return <div className="growth-empty-chart">Selecciona un paciente para consultar sus curvas OMS.</div>;
  }

  if (cargando) {
    return (
      <div className="growth-empty-chart growth-oms-loading">
        <RefreshCw size={20} className="growth-loading-icon" />
        Cargando referencias oficiales OMS...
      </div>
    );
  }

  if (error) {
    return (
      <div className="growth-empty-chart growth-chart-error">
        <Info size={18} />
        <span>{error}</span>
        <button type="button" className="growth-btn" onClick={cargarCurvas}>
          <RefreshCw size={15} /> Reintentar
        </button>
      </div>
    );
  }

  if (!datosOMS) return null;

  return (
    <div className="growth-oms-container">
      <div className="growth-oms-heading">
        <div>
          <h3><Activity size={19} /> Curvas de crecimiento OMS</h3>
          <p>
            Referencias OMS 2006 para {datosOMS.paciente?.sexo === "masculino" ? "niños" : "niñas"} de 0 a 5 años.
          </p>
        </div>
        <span className="growth-oms-version">OMS 2006</span>
      </div>

      <CurvaOMS
        titulo="Peso para la edad"
        descripcion="Evolución del peso de acuerdo con la edad del paciente."
        unidad="kg"
        etiquetaX="Edad (meses)"
        referencias={curvas.peso_edad}
        mediciones={pesoEdad}
      />

      <CurvaOMS
        titulo="Longitud / estatura para la edad"
        descripcion="Comparación de longitud o estatura estandarizada frente a la edad."
        unidad="cm"
        etiquetaX="Edad (meses)"
        referencias={curvas.talla_edad}
        mediciones={tallaEdad}
        controlesExcluidos={controlesSinTalla}
      />

      <CurvaOMS
        titulo="Peso para la longitud"
        descripcion="Relación entre peso y longitud en menores de 24 meses."
        unidad="kg"
        etiquetaX="Longitud estandarizada (cm)"
        referencias={curvas.peso_longitud}
        mediciones={pesoLongitud}
        controlesExcluidos={sinTallaMenores}
      />

      <CurvaOMS
        titulo="Peso para la estatura"
        descripcion="Relación entre peso y estatura a partir de los 24 meses."
        unidad="kg"
        etiquetaX="Estatura estandarizada (cm)"
        referencias={curvas.peso_estatura}
        mediciones={pesoEstatura}
        controlesExcluidos={sinTallaMayores}
      />

      <CurvaOMS
        titulo="Perímetro cefálico para la edad"
        descripcion="Evolución del perímetro cefálico de acuerdo con la edad."
        unidad="cm"
        etiquetaX="Edad (meses)"
        referencias={curvas.perimetro_cefalico}
        mediciones={perimetroEdad}
      />

      {(controlesSinTalla > 0 || controles.some((c) => !Object.keys(c.evaluaciones_oms || {}).length)) && (
        <div className="growth-oms-note">
          <strong>Nota sobre la interpretación</strong>
          <p>
            Los controles antiguos sin método de medición o talla estandarizada no se dibujan en las curvas que requieren longitud o estatura. Los puntos sin evaluación OMS guardada pueden mostrarse, pero no tendrán percentil. No se deben completar retrospectivamente métodos desconocidos.
          </p>
        </div>
      )}

      <div className="growth-oms-note">
        <strong>Percentiles de referencia</strong>
        <p>
          Las líneas corresponden aproximadamente a -3 Z (P0.1), -2 Z (P2.3), -1 Z (P15.9), 0 Z (P50), +1 Z (P84.1), +2 Z (P97.7) y +3 Z (P99.9). El percentil individual se estima desde la puntuación Z guardada y no constituye por sí solo un diagnóstico.
        </p>
      </div>
    </div>
  );
}
