import { api } from './client';
import { 
  Medication, DailyDoseItem, MedicationLog, 
  AdherenceStats, DoseStatus 
} from '../types';

export const medicationService = {
  getMedications: async (elderId?: number): Promise<Medication[]> => {
    const params = elderId ? { elder_id: elderId } : {};
    const res = await api.get<Medication[]>('/medications', { params });
    return res.data;
  },

  createMedication: async (medData: any, elderId?: number): Promise<Medication> => {
    const params = elderId ? { elder_id: elderId } : {};
    const res = await api.post<Medication>('/medications', medData, { params });
    return res.data;
  },

  updateMedication: async (id: number, medData: any): Promise<Medication> => {
    const res = await api.put<Medication>(`/medications/${id}`, medData);
    return res.data;
  },

  deleteMedication: async (id: number): Promise<void> => {
    await api.delete(`/medications/${id}`);
  },

  getDailySchedule: async (elderId?: number, dateStr?: string): Promise<DailyDoseItem[]> => {
    const params: any = {};
    if (elderId) params.elder_id = elderId;
    if (dateStr) params.target_date = dateStr;
    const res = await api.get<DailyDoseItem[]>('/medications/daily-schedule', { params });
    return res.data;
  },

  logDoseAction: async (logId: number, status: DoseStatus, notes?: string): Promise<MedicationLog> => {
    const res = await api.post<MedicationLog>(`/medications/logs/${logId}/action`, { status, notes });
    return res.data;
  }
};

export const adherenceService = {
  getMedicationLogs: async (
    elderId?: number, 
    statusFilter?: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<MedicationLog[]> => {
    const params: any = {};
    if (elderId) params.elder_id = elderId;
    if (statusFilter) params.status_filter = statusFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const res = await api.get<MedicationLog[]>('/medication-logs', { params });
    return res.data;
  },

  getAdherenceStats: async (elderId?: number, daysBack: number = 14): Promise<AdherenceStats> => {
    const params: any = { days_back: daysBack };
    if (elderId) params.elder_id = elderId;
    const res = await api.get<AdherenceStats>('/medication-logs/adherence', { params });
    return res.data;
  }
};
