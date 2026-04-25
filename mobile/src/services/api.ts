import axios from 'axios';

// Use your computer's IP address if testing on a real device
const BASE_URL = 'http://10.0.2.2:8000'; // Android emulator default loopback

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const ActivityService = {
  getHistory: async () => {
    const response = await api.get('/api/activities/sessions/');
    return response.data;
  },
  getLeaderboard: async (cityId: string) => {
    const response = await api.get(`/api/activities/leaderboard/${cityId}/`);
    return response.data;
  },
  getMyRank: async (cityId: string) => {
    const response = await api.get(`/api/activities/leaderboard/${cityId}/me/`);
    return response.data;
  },
};

export const AuthService = {
  login: async (credentials: any) => {
    const response = await api.post('/api/users/login/', credentials);
    return response.data;
  },
  register: async (data: any) => {
    const response = await api.post('/api/users/register/', data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/api/users/me/');
    return response.data;
  }
};

export const PrivacyService = {
  getZones: async () => {
    const response = await api.get('/api/activities/privacy-zones/');
    return response.data;
  },
  createZone: async (zone: any) => {
    const response = await api.post('/api/activities/privacy-zones/', zone);
    return response.data;
  },
  deleteZone: async (id: string) => {
    await api.delete(`/api/activities/privacy-zones/${id}/`);
  }
};

export const POIService = {
  getPOIs: async () => {
    const response = await api.get('/api/activities/pois/');
    return response.data;
  }
};



export default api;
