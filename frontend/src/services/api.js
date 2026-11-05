import axios from 'axios';

const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const TOKEN_STORAGE_KEY = 'nearby_places_token';

const api = axios.create({
  baseURL: `${API_ORIGIN.replace(/\/+$/, '')}/api`,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    let responseData = error.response?.data;
    if (typeof Blob !== 'undefined' && responseData instanceof Blob) {
      const body = await responseData.text();
      try {
        responseData = JSON.parse(body);
      } catch {
        responseData = { detail: body };
      }
    }

    const detail = responseData?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(', ')
      : detail || responseData?.message || error.message;

    return Promise.reject(new Error(message || 'The API request failed.'));
  },
);

export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then(({ data }) => data),
  login: (payload) => api.post('/auth/login', payload).then(({ data }) => data),
  currentUser: () => api.get('/auth/me').then(({ data }) => data),
  listUsers: () => api.get('/auth/admin/users').then(({ data }) => data),
  createUser: (payload) => api.post('/auth/admin/users', payload).then(({ data }) => data),
  updateUser: (userId, payload) => api.patch(`/auth/admin/users/${userId}`, payload).then(({ data }) => data),
  deleteUser: (userId) => api.delete(`/auth/admin/users/${userId}`),
};

export const favoritesApi = {
  list: () => api.get('/favorites').then(({ data }) => data),
  add: (placeId) => api.post(`/favorites/${placeId}`).then(({ data }) => data),
  remove: (placeId) => api.delete(`/favorites/${placeId}`),
};

export const placesApi = {
  list: (params = {}) => api.get('/places', { params }).then(({ data }) => data),
  get: (placeId) => api.get(`/places/${placeId}`).then(({ data }) => data),
  create: (payload) => api.post('/places', payload).then(({ data }) => data),
  update: (placeId, payload) => api.patch(`/places/${placeId}`, payload).then(({ data }) => data),
  remove: (placeId) => api.delete(`/places/${placeId}`),
  nearby: (params) => api.get('/places/nearby', { params }).then(({ data }) => data),
  withinPolygon: (polygon) => api.post('/places/within', polygon).then(({ data }) => data),
  geoJSON: (params = {}) => api.get('/places/geojson', { params }).then(({ data }) => data),
  uploadCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/places/import/csv', formData).then(({ data }) => data);
  },
  uploadGeoJSON: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/places/import/geojson', formData).then(({ data }) => data);
  },
  exportCSV: () => api.get('/places/export/csv', { responseType: 'blob' }),
  exportGeoJSON: () => placesApi.geoJSON(),
};

export default api;
