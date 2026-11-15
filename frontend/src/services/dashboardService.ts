import { api } from './client';

export const dashboardService = {
  getElderDashboard: async () => {
    const res = await api.get('/dashboard/elder');
    return res.data;
  },

  getFamilyDashboard: async () => {
    const res = await api.get('/dashboard/family');
    return res.data;
  },

  getCaregiverDashboard: async () => {
    const res = await api.get('/dashboard/caregiver');
    return res.data;
  }
};
