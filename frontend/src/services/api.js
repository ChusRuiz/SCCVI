import axios from "axios";

// Desarrollo: Vite proxifica /api hacia http://localhost:3000.
// Producción: CloudFront enruta /api/* hacia el Application Load Balancer.
// Si la API se publica en otro dominio, definir VITE_API_URL en el build.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sccvi-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
