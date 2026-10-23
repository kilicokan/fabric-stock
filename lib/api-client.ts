const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(key);
  },
};

const createClient = () => {
  return {
    async request(method: string, endpoint: string, body?: unknown) {
      try {
        const token = await tokenStorage.getItem('authToken');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const options: RequestInit = {
          method,
          headers,
        };

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}${endpoint}`, options);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`API Error (${method} ${endpoint}):`, error);
        throw error;
      }
    },

    get(endpoint: string) {
      return this.request('GET', endpoint);
    },

    post(endpoint: string, body: unknown) {
      return this.request('POST', endpoint, body);
    },

    put(endpoint: string, body: unknown) {
      return this.request('PUT', endpoint, body);
    },

    delete(endpoint: string, body?: unknown) {
      return this.request('DELETE', endpoint, body);
    },
  };
};

const client = createClient();

export const vehicleAPI = {
  list: () => client.get('/vehicles'),
  create: (data: unknown) => client.post('/vehicles', data),
  update: (id: number, data: unknown) => client.put(`/vehicles/${id}`, data),
  delete: (id: number) => client.delete(`/vehicles/${id}`),
  updateLocation: (vehicleId: number, latitude: number, longitude: number, address?: string) =>
    client.post('/vehicles/location', { vehicleId, latitude, longitude, address }),
  getLocations: (vehicleId: number) =>
    client.get(`/vehicles/location?vehicleId=${vehicleId}`),
};

export default client;
