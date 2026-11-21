
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

// ============================================
// SERIES DE REFERENCIA OMS
// ============================================

const SERIES_OMS = [
  { key: "z_menos_3", nombre: "-3 Z", color: "#dc8b45" },
  { key: "z_menos_2", nombre: "-2 Z", color: "#e4b45c" },
  { key: "z_menos_1", nombre: "-1 Z", color: "#94a3b8" },
  { key: "z_0", nombre: "Mediana (0 Z)", color: "#14b8a6", grosor: 3 },
  { key: "z_mas_1", nombre: "+1 Z", color: "#94a3b8" },
  { key: "z_mas_2", nombre: "+2 Z", color: "#e4b45c" },
  { key: "z_mas_3", nombre: "+3 Z", color: "#dc8b45" },
];

// ============================================
// UTILIDADES
// ============================================

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const resultado = Number(valor);

  return Number.isFinite(resultado) ? resultado : null;
}

function formatearFecha(valor) {
  if (!valor) return "Sin fecha";

  const [anio, mes, dia] = String(valor)
    .substring(0, 10)
    .split("-")
    .map(Number);

  if (!anio || !mes || !dia) return "Sin fecha";

  return new Date(anio, mes - 1, dia).toLocaleDateString("es-GT");
}

function prepararReferencias(filas, columnaX) {
  return (filas || [])
    .map((fila) => ({
      x: numero(fila[columnaX]),
      z_menos_3: numero(fila.z_menos_3),
      z_menos_2: numero(fila.z_menos_2),
      z_menos_1: numero(fila.z_menos_1),
      z_0: numero(fila.z_0),
      z_mas_1: numero(fila.z_mas_1),
      z_mas_2: numero(fila.z_mas_2),
      z_mas_3: numero(fila.z_mas_3),
    }))
    .filter(
      (fila) =>
        fila.x !== null &&
        SERIES_OMS.every((serie) => fila[serie.key] !== null)
    )
    .sort((a, b) => a.x - b.x);
}

function prepararMediciones(controles, obtenerX, obtenerY) {
  return (controles || [])
    .map((control) => {
      const x = obtenerX(control);
      const y = obtenerY(control);

      if (x === null || y === null) return null;

      return {
        x,
        y,
        fecha: formatearFecha(control.fecha_control),
        id_control: control.id_control,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);
}

// ============================================
// TOOLTIP PERSONALIZADO
// ============================================

function TooltipOMS({ active, payload, label, unidad }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="growth-oms-tooltip">
      <strong>{Number(label).toFixed(1)}</strong>

      {payload
        .filter((item) => item.value !== null && item.value !== undefined)
        .map((item, index) => (
          <div key={`${item.dataKey}-${index}`}>
            <span
              className="growth-oms-tooltip-dot"
              style={{ background: item.color }}
            />

            <span>{item.name || item.dataKey}:</span>

            <strong>
              {Number(item.value).toFixed(2)} {unidad}
            </strong>
          </div>
        ))}
    </div>
  );
}

// ============================================
// LEYENDA DE REFERENCIAS
// ============================================

function LeyendaOMS() {
  return (
    <div className="growth-oms-legend">
      <div className="growth-oms-legend-item">
        <span className="growth-oms-patient-dot" />
        <span>Paciente</span>
      </div>

      {SERIES_OMS.map((serie) => (
        <div className="growth-oms-legend-item" key={serie.key}>
          <span
            className="growth-oms-line"
            style={{
              background: serie.color,
              height: serie.grosor || 2,
            }}
          />
          <span>{serie.nombre}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// COMPONENTE DE UNA CURVA OMS
// ============================================

function CurvaOMS({
  titulo,
  descripcion,
  unidad,
  etiquetaX,
  referencias,
  mediciones,
  controlesExcluidos = 0,
  formatoX = "numero",
}) {
  const filas = prepararReferencias(referencias, "medida_cm");

  // Las curvas por edad usan edad_meses.
  // Las curvas de peso/talla usan medida_cm.
  const referenciasPreparadas =
    referencias?.length && referencias[0].edad_meses !== undefined
      ? prepararReferencias(referencias, "edad_meses")
      : filas;

  if (!referenciasPreparadas.length) {
    return (
      <div className="growth-chart-card">
        <h3>{titulo}</h3>

        <div className="growth-empty-chart">
          No hay referencias OMS disponibles para esta gráfica.
        </div>
      </div>
    );
  }

  return (
    <div className="growth-chart-card growth-oms-chart-card">
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
          data={referenciasPreparadas}
          margin={{
            top: 15,
            right: 20,
            bottom: 25,
            left: 10,
          }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="4 4"
          />

          <XAxis
            type="number"
            dataKey="x"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            stroke="var(--border)"
            label={{
              value: etiquetaX,
              position: "insideBottom",
              offset: -15,
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
            content={<TooltipOMS unidad={unidad} />}
            isAnimationActive={false}
          />

          {/* Líneas de referencia OMS */}

          {SERIES_OMS.map((serie) => (
            <Line
              key={serie.key}
              type="monotone"
              dataKey={serie.key}
              name={serie.nombre}
              stroke={serie.color}
              strokeWidth={serie.grosor || 1.6}
              strokeDasharray={
                serie.key === "z_0" ? undefined : "5 4"
              }
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}

          {/* Mediciones reales del paciente */}

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
            {controlesExcluidos} controles sin medición estandarizada
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function GraficasCrecimiento({ pacienteId }) {
  const [datosOMS, setDatosOMS] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // ============================================
  // CONSULTAR REFERENCIAS OMS
  // ============================================

  const cargarCurvas = async () => {
    if (!pacienteId) return;

    try {
      setCargando(true);
      setError("");

      const response = await api.get(
        `/crecimiento/paciente/${pacienteId}/curvas-oms`
      );

      setDatosOMS(response.data);
    } catch (err) {
      console.error("Error al cargar curvas OMS:", err);

      setError(
        err.response?.data?.mensaje ||
          "No se pudieron cargar las curvas OMS."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let vigente = true;

    const consultar = async () => {
      if (!pacienteId) {
        setDatosOMS(null);
        return;
      }

      try {
        setCargando(true);
        setError("");
        setDatosOMS(null);

        const response = await api.get(
          `/crecimiento/paciente/${pacienteId}/curvas-oms`
        );

        if (vigente) setDatosOMS(response.data);
      } catch (err) {
        console.error("Error al cargar curvas OMS:", err);

        if (vigente) {
          setError(
            err.response?.data?.mensaje ||
              "No se pudieron cargar las curvas OMS."
          );
        }
      } finally {
        if (vigente) setCargando(false);
      }
    };

    consultar();

    return () => {
      vigente = false;
    };
  }, [pacienteId]);

  // ============================================
  // CONTROLES DEL PACIENTE
  // ============================================

  const controles = datosOMS?.controles || [];
  const curvas = datosOMS?.curvas || {};

  // Peso para la edad

  const pesoEdad = useMemo(
    () =>
      prepararMediciones(
        controles,
        (control) => numero(control.edad_meses),
        (control) => numero(control.peso_kg)
      ),
    [datosOMS]
  );

  // Talla para la edad

  const tallaEdad = useMemo(
    () =>
      prepararMediciones(
        controles,
        (control) => numero(control.edad_meses),
        (control) => numero(control.talla_estandar_oms_cm)
      ),
    [datosOMS]
  );

  // Peso para longitud: menores de 24 meses

  const pesoLongitud = useMemo(
    () =>
      prepararMediciones(
        controles.filter((control) => Number(control.edad_meses) < 24),
        (control) => numero(control.talla_estandar_oms_cm),
        (control) => numero(control.peso_kg)
      ),
    [datosOMS]
  );

  // Peso para estatura: desde los 24 meses

  const pesoEstatura = useMemo(
    () =>
      prepararMediciones(
        controles.filter((control) => Number(control.edad_meses) >= 24),
        (control) => numero(control.talla_estandar_oms_cm),
        (control) => numero(control.peso_kg)
      ),
    [datosOMS]
  );

  // Perímetro cefálico para la edad

  const perimetroEdad = useMemo(
    () =>
      prepararMediciones(
        controles,
        (control) => numero(control.edad_meses),
        (control) => numero(control.perimetro_cefalico_cm)
      ),
    [datosOMS]
  );

  // Controles que no tienen talla estandarizada

  const controlesSinTalla = Number(
    datosOMS?.controles_sin_talla_estandarizada || 0
  );

  // ============================================
  // ESTADOS VISUALES
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
        <RefreshCw size={20} className="growth-loading-icon" />
        <span>Cargando referencias oficiales OMS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="growth-empty-chart growth-chart-error">
        <Info size={18} />
        {error}

        <button
          type="button"
          className="growth-btn"
          onClick={cargarCurvas}
        >
          <RefreshCw size={15} />
          Reintentar
        </button>
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
          <h3>
            <Activity size={19} />
            Curvas de crecimiento OMS
          </h3>

          <p>
            Referencias de crecimiento para{" "}
            {datosOMS.paciente?.sexo === "masculino"
              ? "niños"
              : "niñas"}{" "}
            de 0 a 5 años.
          </p>
        </div>

        <span className="growth-oms-version">OMS 2006</span>
      </div>

      {/* 1. PESO PARA LA EDAD */}

      <CurvaOMS
        titulo="Peso para la edad"
        descripcion="Evolución del peso según la edad del paciente."
        unidad="kg"
        etiquetaX="Edad (meses)"
        referencias={curvas.peso_edad}
        mediciones={pesoEdad}
      />

      {/* 2. TALLA PARA LA EDAD */}

      <CurvaOMS
        titulo="Longitud / estatura para la edad"
        descripcion="Comparación de longitud o estatura estandarizada."
        unidad="cm"
        etiquetaX="Edad (meses)"
        referencias={curvas.talla_edad}
        mediciones={tallaEdad}
        controlesExcluidos={controlesSinTalla}
      />

      {/* 3. PESO PARA LONGITUD */}

      <CurvaOMS
        titulo="Peso para la longitud"
        descripcion="Relación entre peso y longitud en menores de 2 años."
        unidad="kg"
        etiquetaX="Longitud (cm)"
        referencias={curvas.peso_longitud}
        mediciones={pesoLongitud}
        controlesExcluidos={
          controles.filter(
            (control) =>
              Number(control.edad_meses) < 24 &&
              control.talla_estandar_oms_cm == null
          ).length
        }
      />

      {/* 4. PESO PARA ESTATURA */}

      <CurvaOMS
        titulo="Peso para la estatura"
        descripcion="Relación entre peso y estatura desde los 2 años."
        unidad="kg"
        etiquetaX="Estatura (cm)"
        referencias={curvas.peso_estatura}
        mediciones={pesoEstatura}
        controlesExcluidos={
          controles.filter(
            (control) =>
              Number(control.edad_meses) >= 24 &&
              control.talla_estandar_oms_cm == null
          ).length
        }
      />

      {/* 5. PERIMETRO CEFALICO */}

      <CurvaOMS
        titulo="Perímetro cefálico para la edad"
        descripcion="Evolución del perímetro cefálico según la edad."
        unidad="cm"
        etiquetaX="Edad (meses)"
        referencias={curvas.perimetro_cefalico}
        mediciones={perimetroEdad}
      />

      {/* NOTA */}

      <div className="growth-oms-note">
        <strong>Información sobre las curvas OMS</strong>

        <p>
          Las líneas representan referencias de puntuación Z y los puntos
          representan mediciones registradas del paciente. Las curvas de
          peso para longitud y peso para estatura utilizan referencias
          diferentes. Los controles sin método de medición conocido no
          se incluyen en las gráficas que necesitan talla estandarizada.
          Estas curvas sirven para seguimiento y no sustituyen la
          valoración de un profesional de salud.
        </p>
      </div>
    </div>
  );
}
