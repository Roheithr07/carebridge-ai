import { api } from './client';
import { AuthResponse, User } from '../types';

export const authService = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', credentials);
    return res.data;
  },

  register: async (userData: any): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', userData);
    return res.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },

  updateElderProfile: async (data: any) => {
    const res = await api.put('/auth/elder-profile', data);
    return res.data;
  }
};
