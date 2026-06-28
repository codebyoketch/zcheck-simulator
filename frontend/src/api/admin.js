import api from './client';

// ── Exercises ─────────────────────────────────────────────────────────────────
export const adminGetExercises    = (params) => api.get('/admin/exercises/', { params });
export const adminGetExercise     = (slug)   => api.get(`/admin/exercises/${slug}/`);
export const adminCreateExercise  = (data)   => api.post('/admin/exercises/', data);
export const adminUpdateExercise  = (slug, data) => api.put(`/admin/exercises/${slug}/`, data);
export const adminDeleteExercise  = (slug)   => api.delete(`/admin/exercises/${slug}/`);

// ── Test Cases ────────────────────────────────────────────────────────────────
export const adminGetTestCases    = (slug)         => api.get(`/admin/exercises/${slug}/test-cases/`);
export const adminCreateTestCase  = (slug, data)   => api.post(`/admin/exercises/${slug}/test-cases/`, data);
export const adminUpdateTestCase  = (id, data)     => api.put(`/admin/test-cases/${id}/`, data);
export const adminDeleteTestCase  = (id)           => api.delete(`/admin/test-cases/${id}/`);

// ── Languages ─────────────────────────────────────────────────────────────────
export const adminGetLanguages    = ()       => api.get('/admin/languages/');
export const adminCreateLanguage  = (data)   => api.post('/admin/languages/', data);
export const adminUpdateLanguage  = (id, data) => api.put(`/admin/languages/${id}/`, data);
export const adminDeleteLanguage  = (id)     => api.delete(`/admin/languages/${id}/`);

// ── Checkpoints ───────────────────────────────────────────────────────────────
export const adminGetCheckpoints   = ()         => api.get('/admin/checkpoints/');
export const adminCreateCheckpoint = (data)     => api.post('/admin/checkpoints/', data);
export const adminUpdateCheckpoint = (slug, data) => api.put(`/admin/checkpoints/${slug}/`, data);
export const adminDeleteCheckpoint = (slug)     => api.delete(`/admin/checkpoints/${slug}/`);

// ── Users ─────────────────────────────────────────────────────────────────────
export const adminGetUsers        = (params)      => api.get('/auth/admin/users/', { params });
export const adminGetUser         = (id)          => api.get(`/auth/admin/users/${id}/`);
export const adminUpdateUser      = (id, data)    => api.put(`/auth/admin/users/${id}/`, data);
export const adminResetPassword   = (id, data)    => api.post(`/auth/admin/users/${id}/reset-password/`, data);

// ── Submission & Session history (admin) ──────────────────────────────────────
export const adminGetUsersList       = ()               => api.get('/admin/users/');
export const adminGetUserSubmissions = (userId, params) => api.get(`/admin/users/${userId}/submissions/`, { params });
export const adminGetUserSessions    = (userId, params) => api.get(`/admin/users/${userId}/sessions/`, { params });