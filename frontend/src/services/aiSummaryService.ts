import { api } from './client';
import { AISummary } from '../types';

export const aiSummaryService = {
  getSummary: async (elderId?: number): Promise<AISummary> => {
    const params = elderId ? { elder_id: elderId } : {};
    const res = await api.get<AISummary>('/ai-summary', { params });
    return res.data;
  }
};
