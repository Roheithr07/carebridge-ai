import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/api';
import { NotificationItem } from '../types';
import { 
  Bell, CheckCheck, RefreshCw, AlertTriangle, 
  Pill, Calendar, ShieldCheck, HeartHandshake, Clock,
  Trash2, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [scanning, setScanning] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const [data, count] = await Promise.all([
        notificationService.getNotifications(unreadOnly, categoryFilter),
        notificationService.getUnreadCount()
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [unreadOnly, categoryFilter]);

  const handleMarkRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      toast.success('Marked as read');
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const handleDeleteNotif = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification removed');
    } catch (e) {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      const res = await notificationService.triggerScan();
      toast.success(res.message || 'Automated Reminder Engine completed scan!');
      await fetchNotifs();
    } catch (e) {
      toast.error('Failed to run reminder scan');
    } finally {
      setScanning(false);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'missed_dose':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'medication_reminder':
        return <Pill className="w-5 h-5 text-teal-600" />;
      case 'appointment_reminder':
        return <Calendar className="w-5 h-5 text-sky-600" />;
      case 'access_alert':
        return <ShieldCheck className="w-5 h-5 text-purple-600" />;
      default:
        return <HeartHandshake className="w-5 h-5 text-emerald-600" />;
    }
  };

  const categoryTabs = [
    { id: 'all', label: 'All Alerts' },
    { id: 'medication', label: 'Medications' },
    { id: 'appointment', label: 'Appointments' },
    { id: 'security', label: 'Access & Security' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
              <Bell className="w-6 h-6 text-teal-600" /> Notifications & Care Alerts
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-500 text-white shadow-xs">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated alerts for upcoming doses, overdue grace periods, and scheduled doctor appointments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-95"
            title="Scan now for overdue doses and upcoming appointments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-teal-600' : ''}`} />
            <span>Run Scanner</span>
          </button>

          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </button>
        </div>
      </div>

      {/* Category Tabs & Filter Row */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === tab.id
                  ? 'bg-navy-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Checkbox */}
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer self-end sm:self-center pr-2">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded text-teal-600 focus:ring-teal-500"
          />
          Unread only
        </label>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200/80 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-navy-950 text-sm">No Notifications</h3>
            <p className="text-xs text-slate-400 mt-1">You're all caught up with your healthcare updates.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && handleMarkRead(notif.id)}
              className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer flex items-start gap-4 group ${
                !notif.is_read
                  ? 'border-teal-300/80 bg-teal-50/20 shadow-card'
                  : 'border-slate-200/80 opacity-90 hover:opacity-100 shadow-xs'
              }`}
            >
              <div className="p-3 rounded-2xl bg-slate-100 shrink-0">
                {getNotifIcon(notif.notification_type)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-navy-950 text-sm">{notif.title}</h3>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0"></span>
                    )}
                  </div>
                  
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {new Date(notif.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                  {notif.description}
                </p>

                {/* Card actions */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                  {!notif.is_read && (
                    <button
                      onClick={(e) => handleMarkRead(notif.id, e)}
                      className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
                    >
                      <Check className="w-3 h-3" /> Mark Read
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteNotif(notif.id, e)}
                    className="text-[11px] font-bold text-slate-400 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Dismiss alert"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
