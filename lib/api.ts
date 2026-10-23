// lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Service for interacting with fabric-related API endpoints.
 *
 * Provides methods to fetch, create, update, and delete fabric records.
 *
 * @property getFabrics Fetches the list of all fabrics.
 * @property createFabric Creates a new fabric with the provided data.
 * @property updateFabric Updates an existing fabric by its ID with the provided data.
 * @property deleteFabric Deletes a fabric by its ID.
 */
export const fabricService = {
  getFabrics: () => api.get('/fabrics'),
  createFabric: (data: unknown) => api.post('/fabrics', data),
  updateFabric: (id: number | string, data: unknown) => api.put(`/fabrics/${id}`, data),
  deleteFabric: (id: number | string) => api.delete(`/fabrics/${id}`),
};

// Diğer servisler...
export default api;
