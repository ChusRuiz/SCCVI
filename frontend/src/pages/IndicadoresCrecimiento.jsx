
import { Activity, Ruler, Scale, CalendarDays } from "lucide-react";

function IndicadoresCrecimiento({ controles = [] }) {
  const ordenados = [...controles].sort(
    (a, b) => new Date(a.fecha_control) - new Date(b.fecha_control)
  );

  const ultimo = ordenados[ordenados.length - 1];
  const anterior = ordenados[ordenados.length - 2];

  const pesoActual = ultimo ? Number(ultimo.peso_kg) : null;
  const tallaActual = ultimo ? Number(ultimo.talla_cm) : null;

  const diferenciaPeso = anterior
    ? pesoActual - Number(anterior.peso_kg)
    : null;

  const diferenciaTalla = anterior
    ? tallaActual - Number(anterior.talla_cm)
    : null;

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin registros";

    return new Date(fecha).toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const formatoCambio = (valor, unidad) => {
    if (valor === null) return "Sin comparación";

    const signo = valor > 0 ? "+" : "";
    return `${signo}${valor.toFixed(2)} ${unidad}`;
  };

  const tarjetas = [
    {
      titulo: "Peso actual",
      valor: pesoActual !== null ? `${pesoActual.toFixed(2)} kg` : "--",
      cambio: formatoCambio(diferenciaPeso, "kg"),
      icono: Scale,
    },
    {
      titulo: "Talla actual",
      valor: tallaActual !== null ? `${tallaActual.toFixed(2)} cm` : "--",
      cambio: formatoCambio(diferenciaTalla, "cm"),
      icono: Ruler,
    },
    {
      titulo: "Controles realizados",
      valor: ordenados.length,
      cambio: "Registros almacenados",
      icono: Activity,
    },
    {
      titulo: "Último control",
      valor: ultimo ? formatearFecha(ultimo.fecha_control) : "--",
      cambio: "Fecha de medición",
      icono: CalendarDays,
    },
  ];

  return (
    <div className="growth-indicators">
      {tarjetas.map((tarjeta, index) => {
        const Icono = tarjeta.icono;

        return (
          <div className="growth-indicator-card" key={index}>
            <div className="growth-indicator-top">
              <span>{tarjeta.titulo}</span>
              <div className="growth-indicator-icon">
                <Icono size={19} />
              </div>
            </div>

            <h3>{tarjeta.valor}</h3>
            <p>{tarjeta.cambio}</p>
          </div>
        );
      })}
    </div>
  );
}

export default IndicadoresCrecimiento;
