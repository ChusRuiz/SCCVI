function clasificarPuntuacionZ(z, indicador) {
  z = Number(z);

  if (!Number.isFinite(z)) {
    return {
      estado: "no_evaluado",
      descripcion: "No fue posible interpretar el resultado",
      nivel: "sin_datos",
    };
  }

  if (z < -3) {
    return {
      estado: "muy_bajo",
      descripcion: "Muy por debajo del rango de referencia",
      nivel: "critico",
    };
  }

  if (z < -2) {
    return {
      estado: "bajo",
      descripcion: "Por debajo del rango de referencia",
      nivel: "alerta",
    };
  }

  if (z <= 2) {
    return {
      estado: "normal",
      descripcion: "Dentro del rango de referencia",
      nivel: "normal",
    };
  }

  if (z <= 3) {
    return {
      estado: "alto",
      descripcion: "Por encima del rango de referencia",
      nivel: "alerta",
    };
  }

  return {
    estado: "muy_alto",
    descripcion: "Muy por encima del rango de referencia",
    nivel: "critico",
  };
}

module.exports = { clasificarPuntuacionZ };