import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const workOrdersAPI = {
  getAll: () => api.get('/fason/work-orders'),
  getById: (id: string) => api.get(`/fason/work-orders/${id}`),
  create: (data: any) => api.post('/fason/work-orders', data),
  update: (id: string, data: any) => api.put(`/fason/work-orders/${id}`, data),
  delete: (id: string) => api.delete(`/fason/work-orders/${id}`),
};

export const workshopsAPI = {
  getAll: () => api.get('/fason/workshops'),
  getById: (id: string) => api.get(`/fason/workshops/${id}`),
  create: (data: any) => api.post('/fason/workshops', data),
  update: (id: string, data: any) => api.put(`/fason/workshops/${id}`, data),
  delete: (id: string) => api.delete(`/fason/workshops/${id}`),
};

export const trackingAPI = {
  getAll: () => api.get('/fason/tracking'),
  getById: (id: string) => api.get(`/fason/tracking/${id}`),
  create: (data: any) => api.post('/fason/tracking', data),
  update: (id: string, data: any) => api.put(`/fason/tracking/${id}`, data),
  delete: (id: string) => api.delete(`/fason/tracking/${id}`),
};

export default api;
