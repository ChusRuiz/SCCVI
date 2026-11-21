
export function calcularEdad(fechaNacimiento, fechaReferencia = new Date()) {
  if (!fechaNacimiento) return null;

  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  const referencia = new Date(fechaReferencia);

  if (Number.isNaN(nacimiento.getTime()) || nacimiento > referencia) {
    return null;
  }

  let años = referencia.getFullYear() - nacimiento.getFullYear();
  let meses = referencia.getMonth() - nacimiento.getMonth();
  let dias = referencia.getDate() - nacimiento.getDate();

  if (dias < 0) {
    meses--;

    const diasMesAnterior = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      0
    ).getDate();

    dias += diasMesAnterior;
  }

  if (meses < 0) {
    años--;
    meses += 12;
  }

  const totalMeses = años * 12 + meses;

  return {
    años,
    meses,
    dias,
    totalMeses,
    texto:
      años > 0
        ? `${años} años, ${meses} meses`
        : `${meses} meses, ${dias} días`,
  };
}
