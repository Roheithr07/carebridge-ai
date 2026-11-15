import { api } from './client';
import { ActivityItem } from '../types';

export const activityService = {
  getActivityTimeline: async (elderId?: number, limit: number = 50): Promise<ActivityItem[]> => {
    const params: any = { limit };
    if (elderId) params.elder_id = elderId;
    const res = await api.get<ActivityItem[]>('/activity', { params });
    return res.data;
  }
};
