
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function GraficasCrecimiento({ controles = [] }) {
  const datos = [...controles]
    .sort((a, b) => new Date(a.fecha_control) - new Date(b.fecha_control))
    .map((control) => ({
      fecha: new Date(control.fecha_control).toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      }),
      peso: Number(control.peso_kg),
      talla: Number(control.talla_cm),
    }));

  if (datos.length === 0) {
    return (
      <div className="growth-empty-chart">
        No hay suficientes registros para mostrar gráficas.
      </div>
    );
  }

  return (
    <div className="growth-charts">
      <div className="growth-chart-card">
        <div className="growth-chart-header">
          <h3>Evolución del peso</h3>
          <span>Kg</span>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="peso"
              name="Peso"
              stroke="#14b8a6"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="growth-chart-card">
        <div className="growth-chart-header">
          <h3>Evolución de la talla</h3>
          <span>cm</span>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="talla"
              name="Talla"
              stroke="#818cf8"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default GraficasCrecimiento;
