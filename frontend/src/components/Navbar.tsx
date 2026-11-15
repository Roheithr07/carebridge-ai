import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, Eye, LogOut, Heart, User, Users, HeartHandshake, 
  Menu, CheckCheck, RefreshCw, ChevronDown, Sparkles
} from 'lucide-react';
import { notificationService, familyAccessService } from '../services/api';
import { NotificationItem, ConnectedPatient } from '../types';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout, seniorMode, toggleSeniorMode, selectedPatientId, setSelectedPatientId } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [connectedPatients, setConnectedPatients] = useState<ConnectedPatient[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const fetchNotifs = async () => {
    if (!localStorage.getItem('carebridge_token')) return;
    try {
      const data = await notificationService.getNotifications(false);
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPatients = async () => {
    if (!localStorage.getItem('carebridge_token')) return;
    if (user?.role === 'family' || user?.role === 'caregiver') {
      try {
        const patients = await familyAccessService.getConnectedPatients();
        setConnectedPatients(patients);
        if (patients.length > 0 && !selectedPatientId) {
          setSelectedPatientId(patients[0].elder_id);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    fetchNotifs();
    fetchPatients();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error('Failed to mark notifications');
    }
  };

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      await notificationService.triggerScan();
      toast.success('Smart Reminder Engine executed scan!');
      await fetchNotifs();
    } catch (e) {
      toast.error('Scan error');
    } finally {
      setIsScanning(false);
    }
  };

  const getRoleBadge = () => {
    if (user?.role === 'elderly') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80">
          <User className="w-3 h-3 text-teal-600" /> Senior User
        </span>
      );
    }
    if (user?.role === 'family') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200/80">
          <Users className="w-3 h-3 text-sky-600" /> Family Member
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
        <HeartHandshake className="w-3 h-3 text-emerald-600" /> Caregiver RN
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-navy-950 via-navy-900 to-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-all duration-200 ring-1 ring-black/5">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-navy-950">
                  CareBridge<span className="text-teal-500 font-extrabold">AI</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                  SaaS
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Context Patient Selector for Family / Caregiver */}
        {(user?.role === 'family' || user?.role === 'caregiver') && connectedPatients.length > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-100/80 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-500 font-medium">Monitoring:</span>
            <select
              value={selectedPatientId || ''}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              aria-label="Select active monitored patient"
              className="bg-transparent font-bold text-navy-900 focus:outline-none cursor-pointer"
            >
              {connectedPatients.map((p) => (
                <option key={p.elder_id} value={p.elder_id}>
                  {p.elder_name} ({p.relationship_label})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Right Controls: Senior Mode Toggle, Notifications & Account */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Senior High-Contrast / Large Text Mode Toggle */}
          <button
            onClick={toggleSeniorMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              seniorMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm ring-1 ring-amber-300'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/80'
            }`}
            title="Toggle high-contrast large fonts for seniors"
          >
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">
              {seniorMode ? 'Senior Font ON' : 'Senior View'}
            </span>
          </button>

          {/* In-App Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-600 hover:text-navy-950 hover:bg-slate-100 transition-colors focus:outline-none"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Drawer */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-card-elevated border border-slate-200/80 py-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-navy-950 text-sm">Care Alerts</h3>
                    {unreadCount > 0 && (
                      <span className="bg-teal-100 text-teal-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleTriggerScan}
                      disabled={isScanning}
                      title="Run smart reminder scanner now"
                      className="p-1.5 text-slate-400 hover:text-teal-600 transition-colors rounded-lg hover:bg-slate-100"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-teal-600' : ''}`} />
                    </button>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 p-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Read all
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">
                      No notifications right now. Everything is on schedule!
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={async () => {
                          if (!notif.is_read) {
                            await notificationService.markAsRead(notif.id);
                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
                          }
                        }}
                        className={`p-4 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                          !notif.is_read ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-navy-900 leading-snug">{notif.title}</p>
                          {!notif.is_read && (
                            <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">{notif.description}</p>
                        <span className="text-[10px] font-mono text-slate-400 mt-1.5 block">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-3 px-5 border-t border-slate-100 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 block py-1"
                  >
                    View All Notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Account Info */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-navy-950 leading-tight">
                {user?.full_name}
              </div>
              <div className="mt-0.5">{getRoleBadge()}</div>
            </div>

            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Sign Out"
              aria-label="Sign out of CareBridge AI"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
