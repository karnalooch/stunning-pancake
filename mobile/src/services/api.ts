import axios from 'axios';
import { firebaseCapture } from './FirebaseService';

// Use your computer's IP address if testing on a real device
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(request => {
  console.log('--- API REQUEST ---');
  console.log(`${request.method?.toUpperCase()} ${request.url}`);
  if (request.data) console.log('Data:', JSON.stringify(request.data));
  return request;
});

api.interceptors.response.use(
  response => {
    console.log('--- API RESPONSE ---');
    console.log(`Status: ${response.status}`);
    return response;
  },
  error => {
    console.log('--- API ERROR ---');
    firebaseCapture(error, 'API_INTERCEPTOR_ERROR');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Message: ${error.message}`);
    if (error.response?.data) console.log('Response Data:', JSON.stringify(error.response.data));
    return Promise.reject(error);
  }
);

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
    // Backend uses api/auth/token/ for JWT. 
    // Credentials should contain 'username' (which is email) and 'password'.
    const response = await api.post('/api/auth/token/', credentials);
    return response.data;
  },
  register: async (data: any) => {
    const response = await api.post('/api/users/register/', data);
    return response.data;
  },
  getProfile: async () => {
    // Endpoint in users/urls.py is 'profile/'
    const response = await api.get('/api/users/profile/');
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
