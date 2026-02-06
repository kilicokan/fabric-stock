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
