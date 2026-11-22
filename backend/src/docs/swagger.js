const swaggerUi = require("swagger-ui-express");
const plantillaOpenApi = require("./openapi.json");

function montarSwagger(app, { enabled, serverUrl }) {
  if (!enabled) {
    console.log("[SCCVI] Swagger deshabilitado en este entorno.");
    return;
  }

  const documento = {
    ...plantillaOpenApi,
    servers: [{
      url: serverUrl || "http://localhost:3000",
      description: "Servidor SCCVI configurado para este entorno",
    }],
  };

  app.get("/api-docs.json", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(documento);
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(documento, {
      explorer: true,
      customSiteTitle: "SCCVI | Documentación API",
      swaggerOptions: {
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: false,
        docExpansion: "none",
      },
    })
  );

  console.log("[SCCVI] Swagger UI disponible en /api-docs.");
}

module.exports = montarSwagger;
