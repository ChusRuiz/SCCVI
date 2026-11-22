import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  MapPin,
  RefreshCw,
  Syringe,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import api from "../services/api";

function numero(valor, decimales = 0) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-GT", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function fecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(d);
}

function obtenerError(error) {
  return error.response?.data?.mensaje || error.message || "No se pudieron cargar los reportes.";
}

function TarjetaIndicador({ titulo, valor, detalle, Icon, variant = "" }) {
  return (
    <article className="reports-kpi-card">
      <div className={`reports-kpi-icon ${variant}`}><Icon size={20} /></div>
      <div className="reports-kpi-content">
        <span>{titulo}</span>
        <strong>{numero(valor)}</strong>
        <small>{detalle}</small>
      </div>
    </article>
  );
}

function TablaVacia({ columnas, mensaje = "No hay registros para los filtros seleccionados." }) {
  return (
    <tr>
      <td colSpan={columnas} className="reports-empty-cell">{mensaje}</td>
    </tr>
  );
}

export default function Reportes() {
  const [reporte, setReporte] = useState(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState("");
  const [error, setError] = useState("");
  const [actualizadoEn, setActualizadoEn] = useState(null);

  const cargarReportes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;

      const respuesta = await api.get("/reportes/resumen", { params });
      setReporte(respuesta.data);
      setActualizadoEn(new Date());
    } catch (err) {
      console.error("Error cargando reportes SCCVI:", err);
      setError(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    cargarReportes();
  }, [cargarReportes]);

  const indicadores = reporte?.indicadores || {};
  const bajoPeso = reporte?.bajo_peso || [];
  const sobrepeso = reporte?.sobrepeso || [];
  const vacunasIncompletas = reporte?.vacunas_incompletas || [];
  const cobertura = reporte?.cobertura_comunidad || [];
  const crecimiento = reporte?.crecimiento_promedio_comunidad || [];

  const chartCobertura = useMemo(() => cobertura.map((item) => ({
    comunidad: item.comunidad || "Sin comunidad",
    cobertura: Number(item.cobertura_registral_porcentaje || 0),
  })), [cobertura]);

  const periodoTexto = fechaInicio || fechaFin
    ? `${fechaInicio || "Inicio sin definir"} — ${fechaFin || "Sin fecha final"}`
    : "Todos los registros disponibles";

  const prepararHojasExcel = () => {
    const resumen = [
      { Indicador: "Pacientes activos", Valor: indicadores.pacientes_activos ?? 0 },
      { Indicador: "Bajo peso (OMS)", Valor: indicadores.bajo_peso ?? bajoPeso.length },
      { Indicador: "Sobrepeso (OMS)", Valor: indicadores.sobrepeso ?? sobrepeso.length },
      { Indicador: "Vacunas incompletas", Valor: indicadores.vacunas_incompletas ?? vacunasIncompletas.length },
      { Indicador: "Comunidades", Valor: indicadores.comunidades ?? cobertura.length },
      { Indicador: "Pacientes sin comunidad", Valor: indicadores.pacientes_sin_comunidad ?? crecimiento.find((x) => x.id_comunidad === null)?.pacientes_activos ?? 0 },
      { Indicador: "Período", Valor: periodoTexto },
    ];

    const filasBajo = bajoPeso.map((x) => ({
      ID: x.id_paciente,
      Paciente: `${x.nombres || ""} ${x.apellidos || ""}`.trim(),
      Comunidad: x.comunidad || "Sin comunidad asignada",
      "Fecha de control": fecha(x.fecha_control),
      "Peso (kg)": x.peso_kg,
      "Talla (cm)": x.talla_cm,
      "Puntuación Z": x.puntuacion_z,
      "Estado OMS": x.estado_oms,
    }));

    const filasSobre = sobrepeso.map((x) => ({
      ID: x.id_paciente,
      Paciente: `${x.nombres || ""} ${x.apellidos || ""}`.trim(),
      Comunidad: x.comunidad || "Sin comunidad asignada",
      "Fecha de control": fecha(x.fecha_control),
      "Peso (kg)": x.peso_kg,
      "Talla de referencia (cm)": x.talla_referencia_cm,
      "Puntuación Z": x.puntuacion_z,
      "Estado OMS": x.estado_oms,
    }));

    const filasVacunas = vacunasIncompletas.map((x) => ({
      ID: x.id_paciente,
      Paciente: `${x.nombres || ""} ${x.apellidos || ""}`.trim(),
      Comunidad: x.comunidad || "Sin comunidad asignada",
      Motivo: x.motivo === "sin_registros" ? "Sin registros de vacunación" : "Esquema incompleto",
      "Vacunas con registro": x.vacunas_con_registro,
      "Vacunas pendientes": x.vacunas_pendientes,
      Detalle: (x.detalle_pendientes || []).map((v) => `${v.vacuna}: ${v.dosis_aplicadas}/${v.dosis_requeridas}`).join("; "),
    }));

    const filasCobertura = cobertura.map((x) => ({
      Comunidad: x.comunidad || "Sin comunidad asignada",
      "Pacientes activos": x.pacientes_activos,
      "Pacientes con vacuna en período": x.pacientes_con_vacuna_en_periodo,
      "Dosis aplicadas": x.dosis_aplicadas_en_periodo,
      "Cobertura registral (%)": Number(x.cobertura_registral_porcentaje || 0),
    }));

    const filasCrecimiento = crecimiento.map((x) => ({
      Comunidad: x.comunidad || "Sin comunidad asignada",
      "Pacientes activos": x.pacientes_activos,
      "Pacientes con control": x.pacientes_con_control,
      "Peso promedio (kg)": x.peso_promedio_kg,
      "Talla promedio (cm)": x.talla_promedio_cm,
      "Perímetro cefálico promedio (cm)": x.perimetro_cefalico_promedio_cm,
      "Fecha último control": fecha(x.fecha_ultimo_control),
    }));

    return [
      { name: "Resumen", rows: resumen },
      { name: "Bajo peso", rows: filasBajo },
      { name: "Sobrepeso", rows: filasSobre },
      { name: "Vacunas incompletas", rows: filasVacunas },
      { name: "Cobertura por comunidad", rows: filasCobertura },
      { name: "Crecimiento promedio", rows: filasCrecimiento },
    ];
  };

  const exportarExcel = async () => {
    if (!reporte) return;
    setExportando("excel");
    try {
      const libro = XLSX.utils.book_new();
      prepararHojasExcel().forEach(({ name, rows }) => {
        const hoja = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Resultado: "Sin registros" }]);
        hoja["!cols"] = Object.keys(rows[0] || { Resultado: "" }).map((key) => ({ wch: Math.min(Math.max(key.length + 4, 16), 34) }));
        XLSX.utils.book_append_sheet(libro, hoja, name.slice(0, 31));
      });
      XLSX.writeFile(libro, "SCCVI_Reportes.xlsx");
    } catch (err) {
      console.error("Error exportando Excel:", err);
      setError("No se pudo generar el archivo Excel. Verifica que las dependencias estén instaladas.");
    } finally {
      setExportando("");
    }
  };

  const exportarPDF = async () => {
    if (!reporte) return;
    setExportando("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const ancho = doc.internal.pageSize.getWidth();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("SCCVI - Reportes de crecimiento y vacunación", 14, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Período: ${periodoTexto}`, 14, 23);
      doc.text(`Generado: ${new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guatemala" }).format(new Date())}`, ancho - 14, 23, { align: "right" });
      autoTable(doc, {
        startY: 30,
        head: [["Indicador", "Cantidad"]],
        body: [
          ["Pacientes activos", numero(indicadores.pacientes_activos)],
          ["Bajo peso (OMS)", numero(indicadores.bajo_peso ?? bajoPeso.length)],
          ["Sobrepeso (OMS)", numero(indicadores.sobrepeso ?? sobrepeso.length)],
          ["Vacunas incompletas", numero(indicadores.vacunas_incompletas ?? vacunasIncompletas.length)],
          ["Comunidades", numero(indicadores.comunidades ?? cobertura.length)],
          ["Pacientes sin comunidad", numero(indicadores.pacientes_sin_comunidad ?? crecimiento.find((x) => x.id_comunidad === null)?.pacientes_activos ?? 0)],
        ],
        theme: "grid",
        headStyles: { fillColor: [13, 148, 136] },
        styles: { fontSize: 9 },
      });

      const agregarSeccion = (titulo, head, rows) => {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(titulo, 14, 16);
        autoTable(doc, {
          startY: 23,
          head: [head],
          body: rows.length ? rows : [["Sin registros para el período", ...Array(Math.max(head.length - 1, 0)).fill("")]],
          theme: "grid",
          headStyles: { fillColor: [13, 148, 136] },
          styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
          horizontalPageBreak: true,
          horizontalPageBreakRepeat: 0,
        });
      };

      agregarSeccion("Niños con bajo peso - indicador OMS peso/edad",
        ["Paciente", "Comunidad", "Fecha", "Peso kg", "Talla cm", "Puntuación Z", "Estado"],
        bajoPeso.map((x) => [`${x.nombres || ""} ${x.apellidos || ""}`.trim(), x.comunidad || "Sin comunidad", fecha(x.fecha_control), numero(x.peso_kg, 2), numero(x.talla_cm, 2), numero(x.puntuacion_z, 2), x.estado_oms || "—"]));

      agregarSeccion("Niños con sobrepeso - indicador OMS peso/talla",
        ["Paciente", "Comunidad", "Fecha", "Peso kg", "Talla ref. cm", "Puntuación Z", "Estado"],
        sobrepeso.map((x) => [`${x.nombres || ""} ${x.apellidos || ""}`.trim(), x.comunidad || "Sin comunidad", fecha(x.fecha_control), numero(x.peso_kg, 2), numero(x.talla_referencia_cm, 2), numero(x.puntuacion_z, 2), x.estado_oms || "—"]));

      agregarSeccion("Vacunas incompletas",
        ["Paciente", "Comunidad", "Motivo", "Vacunas registradas", "Pendientes", "Detalle"],
        vacunasIncompletas.map((x) => [`${x.nombres || ""} ${x.apellidos || ""}`.trim(), x.comunidad || "Sin comunidad", x.motivo === "sin_registros" ? "Sin registros" : "Incompleto", numero(x.vacunas_con_registro), numero(x.vacunas_pendientes), (x.detalle_pendientes || []).map((v) => `${v.vacuna} ${v.dosis_aplicadas}/${v.dosis_requeridas}`).join("; ")]));

      agregarSeccion("Cobertura registral por comunidad",
        ["Comunidad", "Pacientes activos", "Con vacuna", "Dosis", "Cobertura %"],
        cobertura.map((x) => [x.comunidad || "Sin comunidad", numero(x.pacientes_activos), numero(x.pacientes_con_vacuna_en_periodo), numero(x.dosis_aplicadas_en_periodo), `${numero(x.cobertura_registral_porcentaje, 2)}%`]));

      agregarSeccion("Crecimiento promedio por comunidad",
        ["Comunidad", "Pacientes", "Con control", "Peso kg", "Talla cm", "P. cefálico cm", "Último control"],
        crecimiento.map((x) => [x.comunidad || "Sin comunidad", numero(x.pacientes_activos), numero(x.pacientes_con_control), numero(x.peso_promedio_kg, 2), numero(x.talla_promedio_cm, 2), numero(x.perimetro_cefalico_promedio_cm, 2), fecha(x.fecha_ultimo_control)]));

      doc.save("SCCVI_Reportes.pdf");
    } catch (err) {
      console.error("Error exportando PDF:", err);
      setError("No se pudo generar el archivo PDF. Verifica que las dependencias estén instaladas.");
    } finally {
      setExportando("");
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-page-heading">
        <div>
          <span className="reports-eyebrow">ANÁLISIS DEL CENTRO DE SALUD</span>
          <h2><Activity size={23} /> Reportes y estadísticas</h2>
          <p>Indicadores de crecimiento, vacunación y cobertura por comunidad.</p>
        </div>
        <div className="reports-heading-actions">
          <button className="reports-button secondary" type="button" onClick={cargarReportes} disabled={loading}>
            <RefreshCw size={16} className={loading ? "reports-spin" : ""} /> Actualizar
          </button>
          <button className="reports-button secondary" type="button" onClick={exportarExcel} disabled={!reporte || loading || !!exportando}>
            <FileSpreadsheet size={16} /> {exportando === "excel" ? "Exportando..." : "Excel"}
          </button>
          <button className="reports-button primary" type="button" onClick={exportarPDF} disabled={!reporte || loading || !!exportando}>
            <FileText size={16} /> {exportando === "pdf" ? "Exportando..." : "PDF"}
          </button>
        </div>
      </div>

      <section className="reports-filter-card">
        <div className="reports-filter-title"><CalendarDays size={17} /><strong>Filtrar período</strong></div>
        <div className="reports-filter-controls">
          <label>Fecha inicial<input type="date" value={fechaInicio} max={fechaFin || undefined} onChange={(e) => setFechaInicio(e.target.value)} /></label>
          <label>Fecha final<input type="date" value={fechaFin} min={fechaInicio || undefined} onChange={(e) => setFechaFin(e.target.value)} /></label>
          <button type="button" className="reports-button primary" onClick={cargarReportes} disabled={loading || (fechaInicio && fechaFin && fechaInicio > fechaFin)}>Aplicar filtros</button>
          <button type="button" className="reports-button ghost" onClick={() => { setFechaInicio(""); setFechaFin(""); }}>Limpiar</button>
        </div>
        <small>Período actual: {periodoTexto}</small>
      </section>

      {error && <div className="reports-error"><AlertCircle size={17} />{error}</div>}

      {loading && !reporte ? (
        <div className="reports-loading"><RefreshCw size={22} className="reports-spin" /> Cargando indicadores...</div>
      ) : reporte ? (
        <>
          <section className="reports-kpi-grid">
            <TarjetaIndicador titulo="Pacientes activos" valor={indicadores.pacientes_activos} detalle="Expedientes activos" Icon={Users} />
            <TarjetaIndicador titulo="Bajo peso" valor={indicadores.bajo_peso ?? bajoPeso.length} detalle="Evaluación OMS peso/edad" Icon={HeartPulse} variant="warning" />
            <TarjetaIndicador titulo="Sobrepeso" valor={indicadores.sobrepeso ?? sobrepeso.length} detalle="Evaluación OMS peso/talla" Icon={Activity} variant="danger" />
            <TarjetaIndicador titulo="Vacunas incompletas" valor={indicadores.vacunas_incompletas ?? vacunasIncompletas.length} detalle="Sin registros o con dosis pendientes" Icon={Syringe} variant="purple" />
          </section>

          <div className="reports-secondary-summary">
            <div><MapPin size={18} /><span>Comunidades activas</span><strong>{numero(indicadores.comunidades ?? cobertura.length)}</strong></div>
            <div><Users size={18} /><span>Pacientes sin comunidad</span><strong>{numero(indicadores.pacientes_sin_comunidad ?? crecimiento.find((x) => x.id_comunidad === null)?.pacientes_activos ?? 0)}</strong></div>
            <div className="reports-updated">{actualizadoEn ? `Actualizado ${fecha(actualizadoEn)}` : ""}</div>
          </div>

          <section className="reports-chart-card">
            <div className="reports-section-heading">
              <div><h3>Cobertura registral por comunidad</h3><p>Porcentaje de pacientes activos con al menos una vacunación registrada en el período.</p></div>
            </div>
            {chartCobertura.length ? (
              <div className="reports-chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartCobertura} margin={{ top: 12, right: 16, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="comunidad" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={58} />
                    <YAxis domain={[0, 100]} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(value) => [`${numero(value, 2)}%`, "Cobertura registral"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} />
                    <Bar dataKey="cobertura" name="Cobertura registral" fill="var(--accent)" radius={[7, 7, 0, 0]} maxBarSize={72} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="reports-empty-block">No hay datos de cobertura para mostrar.</div>}
            <p className="reports-method-note">La cobertura es registral y no representa el cumplimiento completo del esquema nacional de vacunación.</p>
          </section>

          <section className="reports-table-card">
            <div className="reports-section-heading"><div><h3>Niños con bajo peso</h3><p>Última evaluación OMS disponible del indicador peso para la edad.</p></div><span className="reports-count">{bajoPeso.length} registros</span></div>
            <div className="reports-table-scroll"><table><thead><tr><th>Paciente</th><th>Comunidad</th><th>Fecha de control</th><th>Peso</th><th>Puntuación Z</th><th>Clasificación OMS</th></tr></thead><tbody>
              {bajoPeso.length ? bajoPeso.map((x) => <tr key={`${x.id_paciente}-${x.id_control}`}><td><strong>{x.nombres} {x.apellidos}</strong><small>ID #{x.id_paciente}</small></td><td>{x.comunidad || "Sin comunidad"}</td><td>{fecha(x.fecha_control)}</td><td>{numero(x.peso_kg, 2)} kg</td><td>{numero(x.puntuacion_z, 2)}</td><td><span className="reports-tag warning">{x.estado_oms || "—"}</span></td></tr>) : <TablaVacia columnas={6} />}
            </tbody></table></div>
          </section>

          <section className="reports-table-card">
            <div className="reports-section-heading"><div><h3>Niños con sobrepeso</h3><p>Última evaluación OMS del indicador peso para la talla.</p></div><span className="reports-count">{sobrepeso.length} registros</span></div>
            <div className="reports-table-scroll"><table><thead><tr><th>Paciente</th><th>Comunidad</th><th>Fecha de control</th><th>Peso</th><th>Talla ref.</th><th>Puntuación Z</th><th>Clasificación OMS</th></tr></thead><tbody>
              {sobrepeso.length ? sobrepeso.map((x) => <tr key={`${x.id_paciente}-${x.id_control}`}><td><strong>{x.nombres} {x.apellidos}</strong><small>ID #{x.id_paciente}</small></td><td>{x.comunidad || "Sin comunidad"}</td><td>{fecha(x.fecha_control)}</td><td>{numero(x.peso_kg, 2)} kg</td><td>{numero(x.talla_referencia_cm, 2)} cm</td><td>{numero(x.puntuacion_z, 2)}</td><td><span className="reports-tag danger">{x.estado_oms || "—"}</span></td></tr>) : <TablaVacia columnas={7} />}
            </tbody></table></div>
          </section>

          <section className="reports-table-card">
            <div className="reports-section-heading"><div><h3>Vacunas incompletas</h3><p>Pacientes sin registros de vacunación o con esquema registrado pendiente.</p></div><span className="reports-count">{vacunasIncompletas.length} pacientes</span></div>
            <div className="reports-table-scroll"><table><thead><tr><th>Paciente</th><th>Comunidad</th><th>Motivo</th><th>Vacunas registradas</th><th>Pendientes</th><th>Detalle</th></tr></thead><tbody>
              {vacunasIncompletas.length ? vacunasIncompletas.map((x) => <tr key={x.id_paciente}><td><strong>{x.nombres} {x.apellidos}</strong><small>ID #{x.id_paciente}</small></td><td>{x.comunidad || "Sin comunidad"}</td><td><span className="reports-tag warning">{x.motivo === "sin_registros" ? "Sin registros" : "Incompleto"}</span></td><td>{numero(x.vacunas_con_registro)}</td><td>{numero(x.vacunas_pendientes)}</td><td>{(x.detalle_pendientes || []).length ? x.detalle_pendientes.map((v) => `${v.vacuna} (${v.dosis_aplicadas}/${v.dosis_requeridas})`).join(", ") : "—"}</td></tr>) : <TablaVacia columnas={6} />}
            </tbody></table></div>
            <p className="reports-method-note">La clasificación depende de las vacunas activas del catálogo y de los registros existentes; no sustituye la revisión del esquema nacional por personal de salud.</p>
          </section>

          <section className="reports-table-card">
            <div className="reports-section-heading"><div><h3>Cobertura por comunidad</h3><p>Pacientes activos con al menos una dosis registrada en el período.</p></div><span className="reports-count">{cobertura.length} comunidades</span></div>
            <div className="reports-table-scroll"><table><thead><tr><th>Comunidad</th><th>Pacientes activos</th><th>Con vacuna</th><th>Dosis aplicadas</th><th>Cobertura registral</th></tr></thead><tbody>
              {cobertura.length ? cobertura.map((x, i) => <tr key={x.id_comunidad ?? `sin-comunidad-${i}`}><td><strong>{x.comunidad || "Sin comunidad asignada"}</strong></td><td>{numero(x.pacientes_activos)}</td><td>{numero(x.pacientes_con_vacuna_en_periodo)}</td><td>{numero(x.dosis_aplicadas_en_periodo)}</td><td><div className="reports-coverage-cell"><strong>{numero(x.cobertura_registral_porcentaje, 2)}%</strong><div className="reports-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(x.cobertura_registral_porcentaje || 0)))}%` }} /></div></div></td></tr>) : <TablaVacia columnas={5} />}
            </tbody></table></div>
            <p className="reports-method-note">“Sin comunidad asignada” se presenta como categoría separada para no excluir a esos pacientes de los indicadores.</p>
          </section>

          <section className="reports-table-card">
            <div className="reports-section-heading"><div><h3>Crecimiento promedio por comunidad</h3><p>Se utiliza la medición más reciente de cada paciente dentro del período.</p></div><span className="reports-count">{crecimiento.length} grupos</span></div>
            <div className="reports-table-scroll"><table><thead><tr><th>Comunidad</th><th>Pacientes</th><th>Con control</th><th>Peso promedio</th><th>Talla promedio</th><th>Perímetro cefálico</th><th>Último control</th></tr></thead><tbody>
              {crecimiento.length ? crecimiento.map((x, i) => <tr key={x.id_comunidad ?? `sin-comunidad-${i}`}><td><strong>{x.comunidad || "Sin comunidad asignada"}</strong></td><td>{numero(x.pacientes_activos)}</td><td>{numero(x.pacientes_con_control)}</td><td>{numero(x.peso_promedio_kg, 2)} kg</td><td>{numero(x.talla_promedio_cm, 2)} cm</td><td>{numero(x.perimetro_cefalico_promedio_cm, 2)} cm</td><td>{fecha(x.fecha_ultimo_control)}</td></tr>) : <TablaVacia columnas={7} />}
            </tbody></table></div>
          </section>

          <div className="reports-disclaimer"><AlertCircle size={17} /><span>Los indicadores muestran registros existentes en SCCVI. Un valor de cero en bajo peso o sobrepeso significa que no se encontraron evaluaciones que cumplan esos criterios, no una certificación de estado nutricional normal.</span></div>
        </>
      ) : !error ? <div className="reports-empty-block">No hay información disponible.</div> : null}
    </div>
  );
}
