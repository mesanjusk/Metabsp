import axios from 'axios';

// No hardcoded production host: a build that forgets VITE_API_URL should fail
// visibly against a relative path rather than silently reaching across to the
// live backend.
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
