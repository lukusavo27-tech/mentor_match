import axios from "axios";

const api = axios.create({
  // In development Vite proxies API paths to FastAPI. Set VITE_API_BASE_URL
  // when deploying the frontend separately.
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mentormatch_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("mentormatch_token")) {
      localStorage.removeItem("mentormatch_token");
      window.dispatchEvent(new Event("mentormatch:session-expired"));
    }
    return Promise.reject(error);
  }
);

export default api;
