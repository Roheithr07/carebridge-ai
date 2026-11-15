import { api } from './client';
import { NotificationItem } from '../types';

export const notificationService = {
  getNotifications: async (unreadOnly: boolean = false, category?: string): Promise<NotificationItem[]> => {
    const params: any = { unread_only: unreadOnly };
    if (category && category !== 'all') {
      params.category = category;
    }
    const res = await api.get<NotificationItem[]>('/notifications', { params });
    return res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await api.get<{ unread_count: number }>('/notifications/unread-count');
    return res.data.unread_count;
  },

  markAsRead: async (id: number) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },

  deleteNotification: async (id: number) => {
    const res = await api.delete(`/notifications/${id}`);
    return res.data;
  },

  triggerScan: async () => {
    const res = await api.post('/notifications/trigger-reminders');
    return res.data;
  }
};
