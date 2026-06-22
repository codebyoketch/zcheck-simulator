import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE  = process.env.REACT_APP_WS_URL  || 'ws://localhost:8000';

const api = axios.create({ baseURL: `${BASE_URL}/api` });

// Attach JWT access token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh');
        const { data } = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, { refresh });
        localStorage.setItem('access', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = d  => api.post('/auth/register/', d);
export const login    = d  => api.post('/auth/login/', d);
export const getMe    = () => api.get('/auth/me/');

// ── Exercises ─────────────────────────────────────────────────────────────────
export const getExercises   = (params) => api.get('/exercises/', { params });
export const getExercise    = (slug)   => api.get(`/exercises/${slug}/`);
export const getRandomExercise = (params) => api.get('/exercises/random/', { params });
export const getCheckpoints = () => api.get('/checkpoints/');
export const getLanguages   = () => api.get('/languages/');

// ── Submissions ───────────────────────────────────────────────────────────────
export const submitCode     = (data) => api.post('/submit/', data);
export const getSubmission  = (id)   => api.get(`/submissions/${id}/`);
export const getProgress    = ()     => api.get('/progress/');
export const getHistory     = ()     => api.get('/history/');
export const startSession   = (data) => api.post('/sessions/start/', data);
export const endSession     = (id, data) => api.patch(`/sessions/${id}/end/`, data);

// ── WebSocket ─────────────────────────────────────────────────────────────────
export const createSubmissionSocket = (submissionId) => {
  const token = localStorage.getItem('access');
  return new WebSocket(`${WS_BASE}/ws/submissions/${submissionId}/?token=${token}`);
};

export default api;
