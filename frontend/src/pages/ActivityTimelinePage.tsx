import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityService } from '../services/api';
import { ActivityItem } from '../types';
import { 
  Activity, CheckCircle2, XCircle, AlertTriangle, 
  Pill, Calendar, ShieldCheck, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

export const ActivityTimelinePage: React.FC = () => {
  const { user, selectedPatientId } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  const targetElderId = user?.role === 'elderly' ? undefined : (selectedPatientId || undefined);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await activityService.getActivityTimeline(targetElderId, 50);
      setActivities(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load activity timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [targetElderId]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'dose_taken':
        return { icon: CheckCircle2, bg: 'bg-emerald-100 text-emerald-700', label: 'Dose Taken' };
      case 'dose_skipped':
        return { icon: XCircle, bg: 'bg-slate-100 text-slate-700', label: 'Dose Skipped' };
      case 'missed_dose_detected':
        return { icon: AlertTriangle, bg: 'bg-red-100 text-red-700', label: 'Missed Dose Alert' };
      case 'medication_added':
      case 'medication_updated':
        return { icon: Pill, bg: 'bg-teal-100 text-teal-700', label: 'Medication Update' };
      case 'appointment_created':
      case 'appointment_updated':
        return { icon: Calendar, bg: 'bg-sky-100 text-sky-700', label: 'Appointment' };
      case 'access_granted':
      case 'access_revoked':
        return { icon: ShieldCheck, bg: 'bg-purple-100 text-purple-700', label: 'Access Control' };
      default:
        return { icon: Activity, bg: 'bg-slate-100 text-slate-700', label: 'Care Note' };
    }
  };

  const filtered = activities.filter((act) => {
    if (filterType === 'all') return true;
    if (filterType === 'doses') return act.action_type.includes('dose');
    if (filterType === 'meds') return act.action_type.includes('medication');
    if (filterType === 'appts') return act.action_type.includes('appointment');
    if (filterType === 'access') return act.action_type.includes('access');
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-600" /> Healthcare Activity Timeline
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Auditable, chronological care log of medication confirmations, doctor visits, and security authorizations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'doses', label: 'Doses' },
            { id: 'meds', label: 'Medications' },
            { id: 'appts', label: 'Appointments' },
            { id: 'access', label: 'Security' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterType === f.id
                  ? 'bg-navy-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-card">
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-200/80 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">No activity records match this filter.</p>
        ) : (
          <div className="relative pl-6 space-y-6 border-l-2 border-slate-100">
            {filtered.map((item) => {
              const badge = getActionBadge(item.action_type);
              const Icon = badge.icon;

              return (
                <div key={item.id} className="relative group">
                  {/* Dot on Timeline line */}
                  <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full flex items-center justify-center ${badge.bg} ring-4 ring-white shadow-xs`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* Content Card */}
                  <div className="bg-slate-50/70 group-hover:bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(item.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-navy-950 leading-snug">
                      {item.description}
                    </p>

                    <div className="mt-2 text-[11px] text-slate-500 font-medium">
                      Recorded by: <strong className="text-navy-900">{item.user_name || 'CareBridge Automated Engine'}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
