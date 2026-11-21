const LIMITES = {
  peso_edad: {
    inferior: -2,
    inferiorSevero: -3,
  },
  talla_edad: {
    inferior: -2,
    inferiorSevero: -3,
  },
  peso_talla: {
    inferior: -2,
    inferiorSevero: -3,
    superior: 2,
    superiorSevero: 3,
  },
  perimetro_cefalico: {
    inferior: -2,
    superior: 2,
  },
};

function interpretarIndicador(indicador, puntuacionZ) {
  const z = Number(puntuacionZ);

  if (!Number.isFinite(z)) {
    return {
      estado: "no_evaluable",
      descripcion: "No se pudo interpretar la puntuacion Z.",
    };
  }

  const limites = LIMITES[indicador];

  if (!limites) {
    return {
      estado: "no_evaluable",
      descripcion: "Indicador no reconocido.",
    };
  }

  switch (indicador) {
    case "peso_edad":
      if (z < -3) {
        return {
          estado: "peso_muy_bajo",
          descripcion: "Peso muy bajo para la edad.",
        };
      }

      if (z < -2) {
        return {
          estado: "peso_bajo",
          descripcion: "Peso bajo para la edad.",
        };
      }

      return {
        estado: "normal",
        descripcion: "Peso dentro del rango de referencia.",
      };

    case "talla_edad":
      if (z < -3) {
        return {
          estado: "talla_muy_baja",
          descripcion: "Talla muy baja para la edad.",
        };
      }

      if (z < -2) {
        return {
          estado: "talla_baja",
          descripcion: "Talla baja para la edad.",
        };
      }

      return {
        estado: "normal",
        descripcion: "Talla dentro del rango de referencia.",
      };

    case "peso_talla":
      if (z < -3) {
        return {
          estado: "desnutricion_aguda_severa",
          descripcion: "Peso muy bajo en relacion con la talla.",
        };
      }

      if (z < -2) {
        return {
          estado: "desnutricion_aguda",
          descripcion: "Peso bajo en relacion con la talla.",
        };
      }

      if (z > 3) {
        return {
          estado: "obesidad",
          descripcion: "Peso muy elevado en relacion con la talla.",
        };
      }

      if (z > 2) {
        return {
          estado: "sobrepeso",
          descripcion: "Peso elevado en relacion con la talla.",
        };
      }

      return {
        estado: "normal",
        descripcion: "Peso dentro del rango esperado para la talla.",
      };

    case "perimetro_cefalico":
      if (z < -2) {
        return {
          estado: "perimetro_bajo",
          descripcion: "Perimetro cefalico por debajo del rango de referencia.",
        };
      }

      if (z > 2) {
        return {
          estado: "perimetro_alto",
          descripcion: "Perimetro cefalico por encima del rango de referencia.",
        };
      }

      return {
        estado: "normal",
        descripcion: "Perimetro cefalico dentro del rango de referencia.",
      };

    default:
      return {
        estado: "no_evaluable",
        descripcion: "Indicador no reconocido.",
      };
  }
}

function interpretarEvaluaciones(evaluaciones) {
  const resultado = {};

  for (const [indicador, evaluacion] of Object.entries(evaluaciones || {})) {
    const interpretacion = interpretarIndicador(
      indicador,
      evaluacion.puntuacion_z
    );

    resultado[indicador] = {
      ...evaluacion,
      interpretacion,
    };
  }

  return resultado;
}

module.exports = {
  interpretarIndicador,
  interpretarEvaluaciones,
};