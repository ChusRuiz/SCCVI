# Node 24 es una línea LTS y mantiene buena compatibilidad con las dependencias actuales.
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
USER node
EXPOSE 3000
# La salud de la API se configura en el target group del ALB (/health/ready).
# No se incluye HEALTHCHECK en la imagen compartida porque también ejecutará el worker,
# que no expone un servidor HTTP.
CMD ["node", "src/server.js"]
