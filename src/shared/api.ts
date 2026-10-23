import api from '../../lib/api';

// API functions for mobile tracker
export const trackingAPI = {
  create: async (data: any) => {
    const response = await api.post('/fason/tracking', data);
    return response;
  }
};

export const workOrdersAPI = {
  getAll: async () => {
    const response = await api.get('/fason/work-orders/mobile');
    return { data: response.data.workOrders || [] };
  }
};

export const workshopsAPI = {
  getMobileWorkshops: async () => {
    const response = await api.get('/mobile-workshops');
    return response;
  }
};

export const vehiclesAPI = {
  list: async () => {
    const response = await api.get('/vehicles');
    return { success: true, data: response.data || [] };
  },
  create: async (data: any) => {
    const response = await api.post('/vehicles', data);
    return response;
  },
  update: async (id: number, data: any) => {
    const response = await api.put('/vehicles', { id, ...data });
    return response;
  },
  delete: async (id: number) => {
    const response = await api.delete('/vehicles', { data: { id } });
    return response;
  },
  updateLocation: async (vehicleId: number, latitude: number, longitude: number, address?: string) => {
    const response = await api.post('/vehicles/location', {
      vehicleId,
      latitude,
      longitude,
      address,
    });
    return response;
  },
  getLocations: async (vehicleId: number, limit?: number) => {
    const response = await api.get(`/vehicles/location?vehicleId=${vehicleId}&limit=${limit || 50}`);
    return response;
  }
};
