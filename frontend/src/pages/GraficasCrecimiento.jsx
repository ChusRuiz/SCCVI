
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
  Legend,
} from "recharts";

import api from "../services/api";

// ============================================
// CONFIGURACIÓN DE CURVAS OMS
// ============================================

const SERIES_OMS = [
  {
    key: "z_menos_3",
    nombre: "-3 Z",
    color: "#dc8b45",
  },
  {
    key: "z_menos_2",
    nombre: "-2 Z",
    color: "#e4b45c",
  },
  {
    key: "z_menos_1",
    nombre: "-1 Z",
    color: "#94a3b8",
  },
  {
    key: "z_0",
    nombre: "Mediana (0 Z)",
    color: "#14b8a6",
    grosor: 3,
  },
  {
    key: "z_mas_1",
    nombre: "+1 Z",
    color: "#94a3b8",
  },
  {
    key: "z_mas_2",
    nombre: "+2 Z",
    color: "#e4b45c",
  },
  {
    key: "z_mas_3",
    nombre: "+3 Z",
    color: "#dc8b45",
  },
];

// ============================================
// FORMATEAR FECHA
// ============================================

function formatearFecha(valor) {
  if (!valor) return "Sin fecha";

  const [anio, mes, dia] = String(valor)
    .substring(0, 10)
    .split("-")
    .map(Number);

  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT");
}

// ============================================
// TOOLTIP PERSONALIZADO
// ============================================

function TooltipOMS({ active, payload, label, unidad }) {
  if (!active || !payload || !payload.length) return null;

  const puntos = payload.filter(
    (elemento) => elemento.value !== null &&
      elemento.value !== undefined
  );

  return (
    <div className="growth-oms-tooltip">
      <div >

      <strong >Edad: {label} meses</strong>
      </div>
      {puntos.map((elemento, index) => (
        <div key={`${elemento.name}-${index}`}>
          <span
            className="growth-oms-tooltip-dot"
            style={{ background: elemento.color }}
          />

          <span>{elemento.name}:</span>

          <strong>
            {Number(elemento.value).toFixed(2)} {unidad}
          </strong>
        </div>
      ))}
    </div>
  );
}

// ============================================
// GRÁFICA DE REFERENCIA OMS
// ============================================

function GraficaOMS({
  titulo,
  subtitulo,
  unidad,
  referencias,
  mediciones,
  controlesExcluidos = 0,
}) {
  if (!referencias || referencias.length === 0) {
    return (
      <div className="growth-chart-card">
        <h3>{titulo}</h3>

        <div className="growth-empty-chart">
          No hay referencias OMS disponibles para este indicador.
        </div>
      </div>
    );
  }

  return (
    <div className="growth-chart-card">
      <div className="growth-chart-header">
        <div>
          <h3>{titulo}</h3>
          <p>{subtitulo}</p>
        </div>

        <span>{unidad}</span>
      </div>

      <div className="growth-curve-legend">
        <span className="growth-curve-patient-dot" />
        <span>Mediciones del paciente</span>

        <span className="growth-curve-reference-line" />
        <span>Referencias OMS</span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={referencias}
          margin={{
            top: 15,
            right: 20,
            bottom: 25,
            left: 5,
          }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="4 4"
          />

          <XAxis
            type="number"
            dataKey="edad_meses"
            domain={[0, 60]}
            allowDecimals={false}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            stroke="var(--border)"
            label={{
              value: "Edad (meses)",
              position: "insideBottom",
              offset: -15,
              fill: "var(--text-secondary)",
              fontSize: 12,
            }}
          />

          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            stroke="var(--border)"
            width={55}
            label={{
              value: unidad,
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-secondary)",
              fontSize: 12,
            }}
          />

          <Tooltip
            content={<TooltipOMS unidad={unidad} />}
            isAnimationActive={false}
          />

          <Legend
            verticalAlign="bottom"
            height={32}
            wrapperStyle={{
              fontSize: "11px",
              color: "var(--text-secondary)",
            }}
          />

          {/* CURVAS DE REFERENCIA OMS */}

          {SERIES_OMS.map((serie) => (
            <Line
              key={serie.key}
              type="monotone"
              dataKey={serie.key}
              name={serie.nombre}
              stroke={serie.color}
              strokeWidth={serie.grosor || 1.7}
              strokeDasharray={
                serie.key === "z_0" ? undefined : "5 4"
              }
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}

          {/* MEDICIONES REALES DEL PACIENTE */}

          <Scatter
            name="Paciente"
            data={mediciones}
            dataKey="valor"
            fill="#0f766e"
            shape="circle"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="growth-curve-footer">
        <span>
          {mediciones.length} mediciones incluidas
        </span>

        {controlesExcluidos > 0 && (
          <span className="growth-curve-excluded">
            {controlesExcluidos} controles sin talla estandarizada
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function GraficasCrecimiento({
  pacienteId,
}) {
  const [datosOMS, setDatosOMS] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // ============================================
  // CONSULTAR CURVAS OMS
  // ============================================

  useEffect(() => {
    if (!pacienteId) {
      setDatosOMS(null);
      return;
    }

    let vigente = true;

    const cargarCurvas = async () => {
      try {
        setCargando(true);
        setError("");
        setDatosOMS(null);

        const response = await api.get(
          `/crecimiento/paciente/${pacienteId}/curvas-oms`
        );

        if (vigente) {
          setDatosOMS(response.data);
        }
      } catch (err) {
        console.error("Error al cargar curvas OMS:", err);

        if (vigente) {
          setError(
            err.response?.data?.mensaje ||
            "No se pudieron cargar las curvas OMS."
          );
        }
      } finally {
        if (vigente) {
          setCargando(false);
        }
      }
    };

    cargarCurvas();

    return () => {
      vigente = false;
    };
  }, [pacienteId]);

  // ============================================
  // PROCESAR MEDICIONES DEL PACIENTE
  // ============================================

  const controles = datosOMS?.controles || [];

  const datosPeso = useMemo(
    () =>
      controles
        .filter(
          (control) =>
            Number.isFinite(Number(control.peso_kg)) &&
            control.peso_kg !== null
        )
        .map((control) => ({
          edad_meses: Number(control.edad_meses),
          valor: Number(control.peso_kg),
          fecha: formatearFecha(control.fecha_control),
          id_control: control.id_control,
        }))
        .filter((control) =>
          Number.isFinite(control.edad_meses)
        ),
    [datosOMS]
  );

  const datosTalla = useMemo(
    () =>
      controles
        .filter(
          (control) =>
            control.talla_estandar_oms_cm !== null &&
            control.talla_estandar_oms_cm !== undefined
        )
        .map((control) => ({
          edad_meses: Number(control.edad_meses),
          valor: Number(control.talla_estandar_oms_cm),
          fecha: formatearFecha(control.fecha_control),
          id_control: control.id_control,
        }))
        .filter(
          (control) =>
            Number.isFinite(control.edad_meses) &&
            Number.isFinite(control.valor)
        ),
    [datosOMS]
  );

  const controlesSinTalla = Number(
    datosOMS?.controles_sin_talla_estandarizada || 0
  );

  // ============================================
  // ESTADOS DE CARGA Y ERROR
  // ============================================

  if (!pacienteId) {
    return (
      <div className="growth-empty-chart">
        Selecciona un paciente para consultar sus curvas OMS.
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="growth-empty-chart">
        Cargando referencias oficiales de crecimiento OMS...
      </div>
    );
  }

  if (error) {
    return (
      <div className="growth-empty-chart growth-chart-error">
        {error}
      </div>
    );
  }

  if (!datosOMS) return null;

  // ============================================
  // RENDERIZADO
  // ============================================

  return (
    <div className="growth-oms-container">

      <div className="growth-oms-heading">
        <div>
          <h3>Curvas de crecimiento OMS</h3>

          <p>
            Referencias para{" "}
            {datosOMS.paciente?.sexo === "masculino"
              ? "niños"
              : "niñas"}{" "}
            de 0 a 5 años.
          </p>
        </div>

        <span className="growth-oms-version">
          OMS 2006
        </span>
      </div>

      <GraficaOMS
        titulo="Peso para la edad"
        subtitulo="Evolución del peso frente a los estándares OMS."
        unidad="kg"
        referencias={datosOMS.curvas?.peso_edad || []}
        mediciones={datosPeso}
      />

      <GraficaOMS
        titulo="Longitud / estatura para la edad"
        subtitulo="Mediciones estandarizadas comparadas con las referencias OMS."
        unidad="cm"
        referencias={datosOMS.curvas?.talla_edad || []}
        mediciones={datosTalla}
        controlesExcluidos={controlesSinTalla}
      />

      <div className="growth-oms-note">
        <strong>Información sobre las curvas</strong>

        <p>
          Las líneas representan las puntuaciones Z de referencia OMS.
          Los puntos representan las mediciones registradas del paciente.
          Los controles sin método de medición conocido no se incluyen
          en la gráfica de longitud/estatura.
        </p>
      </div>

    </div>
  );
}
