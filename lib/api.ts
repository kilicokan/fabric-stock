// lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

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
  createFabric: (data) => api.post('/fabrics', data),
  updateFabric: (id, data) => api.put(`/fabrics/${id}`, data),
  deleteFabric: (id) => api.delete(`/fabrics/${id}`),
};

// Diğer servisler...
export default api;