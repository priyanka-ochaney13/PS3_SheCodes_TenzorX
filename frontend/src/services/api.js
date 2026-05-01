// src/services/api.js
import axios from "axios";

// Change this to your FastAPI backend URL
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
});

export default api;
