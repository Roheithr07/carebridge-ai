import { api } from './client';
import { Appointment } from '../types';

export const appointmentService = {
  getAppointments: async (elderId?: number, upcomingOnly: boolean = false): Promise<Appointment[]> => {
    const params: any = { upcoming_only: upcomingOnly };
    if (elderId) params.elder_id = elderId;
    const res = await api.get<Appointment[]>('/appointments', { params });
    return res.data;
  },

  createAppointment: async (apptData: any, elderId?: number): Promise<Appointment> => {
    const params = elderId ? { elder_id: elderId } : {};
    const res = await api.post<Appointment>('/appointments', apptData, { params });
    return res.data;
  },

  updateAppointment: async (id: number, apptData: any): Promise<Appointment> => {
    const res = await api.put<Appointment>(`/appointments/${id}`, apptData);
    return res.data;
  },

  deleteAppointment: async (id: number): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  }
};
