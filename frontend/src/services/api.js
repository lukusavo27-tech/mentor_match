import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, ""),
  timeout: 15000,
  headers: { Accept: "application/json", "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mentormatch_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Let the browser attach the multipart boundary for resume uploads.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

export default api;
