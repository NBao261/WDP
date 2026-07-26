import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Facility, PricingPlan, AvailableSlot } from '../types/facility.types';

import Constants from 'expo-constants';

// ─── API Configuration ───────────────────────────────
// Ưu tiên EXPO_PUBLIC_API_URL từ .env
let API_URL = process.env.EXPO_PUBLIC_API_URL;

// Auto-detect local IP in Expo Go development mode
if (__DEV__ && !API_URL) {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    API_URL = `http://${ip}:5000/api/v1`;
  }
}

// Fallback: Android Emulator dùng 10.0.2.2, iOS Simulator dùng localhost
if (!API_URL) {
  API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api/v1' : 'http://localhost:5000/api/v1';
}

if (Platform.OS === 'android' && API_URL.includes('localhost')) {
  API_URL = API_URL.replace('localhost', '10.0.2.2');
}

export const getBaseUrl = () => {
  return API_URL.replace(/\/api\/v1\/?$/, '');
};

export const TOKEN_KEY = 'sp_access_token';
export const REFRESH_TOKEN_KEY = 'sp_refresh_token';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Public Routes
  getPublicFacilities: async (page = 1, limit = 10, search?: string, status?: string, vehicleTypeId?: string) => {
    let url = `/public/facilities?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status && status !== 'all') url += `&status=${status}`;
    if (vehicleTypeId && vehicleTypeId !== 'all') url += `&vehicleTypeId=${vehicleTypeId}`;
    const response = await apiClient.get<any, { success: boolean, data: Facility[], pagination: any }>(url);
    return response.data;
  },
  getPublicPricing: async (facilityId: string) => {
    const response = await apiClient.get<any, { success: boolean, data: PricingPlan[] }>(`/public/facilities/${facilityId}/pricing`);
    return response.data;
  },
  getAvailableSlots: async (facilityId: string) => {
    const response = await apiClient.get<any, { success: boolean, data: AvailableSlot[] }>(`/public/facilities/${facilityId}/available-slots`);
    return response.data;
  },
};

export const sessionApi = {
  getMySessions: (status?: 'active' | 'completed') => {
    return apiClient.get('/sessions/my-sessions', { params: { status } });
  },
  getActiveSessions: (params?: { facilityId?: string }) => {
    return apiClient.get('/sessions/active', { params });
  },
  searchSession: (query: { licensePlate?: string; cardCode?: string }) => {
    return apiClient.get('/sessions/search', { params: query });
  },
  calculateFee: (sessionId: string) => {
    return apiClient.get(`/sessions/${sessionId}/fee`);
  },
  checkIn: (data: { facilityId: string; vehicleTypeId: string; licensePlate?: string; gateIn?: string; checkInImage?: string; cardCode?: string }) => {
    return apiClient.post('/sessions/check-in', {
      ...data,
      gateIn: data.gateIn || "Mobile Gate",
    });
  }
};

// Payment API
export const paymentApi = {
  cashCheckout: (data: { sessionId: string; gateOut?: string; checkOutImage?: string }) => {
    return apiClient.post('/payments/cash-checkout', {
      ...data,
      gateOut: data.gateOut || "Mobile Gate",
    });
  }
};

// ALPR API
export const alprApi = {
  scanPlate: async (formData: FormData): Promise<{ success: boolean; message: string; data: any }> => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const response = await fetch(`${API_URL}/alpr/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Do NOT set Content-Type here, let fetch generate the boundary
      },
      body: formData
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw errData;
    }
    return response.json();
  }
};

// Reservation API
export const reservationApi = {
  createReservation: (data: { facilityId: string; vehicleTypeId: string; licensePlate: string; startTime: string; }) => {
    return apiClient.post('/reservations', data);
  },
  getReservations: (status?: 'pending' | 'confirmed' | 'used' | 'cancelled' | 'expired') => {
    return apiClient.get('/reservations', { params: { status } });
  },
  cancelReservation: (id: string) => {
    return apiClient.post(`/reservations/${id}/cancel`);
  }
};

// Vehicle Type API
export const vehicleTypeApi = {
  getVehicleTypes: async (): Promise<any> => {
    return apiClient.get('/vehicle-types');
  }
};

// Feedback API
export const feedbackApi = {
  createFeedback: (data: { type: string; description: string; images?: string[]; sessionId?: string; facilityId?: string; }) => {
    return apiClient.post('/feedbacks', data);
  },
  getFeedbacks: (params?: { page?: number; limit?: number; status?: string; type?: string }) => {
    return apiClient.get('/feedbacks', { params });
  }
};

// Exception API
export const exceptionApi = {
  getExceptions: (params?: any) => {
    return apiClient.get('/exceptions', { params });
  },
  createException: (data: { 
    type: string; 
    description?: string; 
    facilityId: string;
    expectedPlate?: string;
    actualPlate?: string;
    checkInImage?: string;
    checkOutImage?: string;
    sessionId?: string;
    cardCode?: string;
  }) => {
    return apiClient.post('/exceptions', data);
  },
  // Cho driver gửi sự cố (timeout dài hơn cho ảnh base64)
  createDriverReport: (data: { sessionId: string; type: string; description: string; images?: string[] }) => {
    return apiClient.post('/exceptions/driver-report', data, { timeout: 30000 });
  },
  // Lấy danh sách sự cố của driver
  getMyReports: () => {
    return apiClient.get('/exceptions/my-reports');
  }
};

export const locationApi = {
  getNearbyFacilities: (params: { lat: number; lng: number; radius: number }) => {
    return apiClient.get('/search/nearby', { params });
  }
};

export const facilityApi = {
  getFacilities: () => {
    return apiClient.get('/facilities');
  },
  getOperationsConfig: (id: string) => {
    return apiClient.get(`/facilities/${id}/operations-config`);
  }
};

export const authApi = {
  changePassword: (data: any) => {
    return apiClient.put('/auth/change-password', data);
  }
};

export const vehicleApi = {
  addVehicle: (data: { vehicleTypeId: string; licensePlate: string; nickname?: string; image?: string }) => {
    return apiClient.post('/vehicles', data, { timeout: 30000 });
  },
  getMyVehicles: () => {
    return apiClient.get('/vehicles/my');
  },
  getVehicleById: (id: string) => {
    return apiClient.get(`/vehicles/${id}`);
  },
  updateVehicle: (id: string, data: { vehicleTypeId?: string; licensePlate?: string; nickname?: string; image?: string; isDefault?: boolean }) => {
    return apiClient.patch(`/vehicles/${id}`, data, { timeout: 30000 });
  },
  deleteVehicle: (id: string) => {
    return apiClient.delete(`/vehicles/${id}`);
  },
};

export const userApi = {
  updateDeviceToken: (deviceToken: string) => {
    return apiClient.put('/users/device-token', { deviceToken });
  }
};

// ─── Request Interceptor: Attach token ────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: Global error handling ──────
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Auto refresh token on 401 (one retry)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken,
          });

          // Save new tokens
          await SecureStore.setItemAsync(TOKEN_KEY, data.data.tokens.accessToken);
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.data.tokens.refreshToken);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${data.data.tokens.accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed — clear tokens (force re-login)
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    }

    return Promise.reject(error.response?.data || error.message);
  },
);

// ─── Token Helpers ────────────────────────────────────
export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

export const getAccessToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(TOKEN_KEY);
};
