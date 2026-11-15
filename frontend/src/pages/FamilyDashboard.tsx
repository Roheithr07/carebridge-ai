import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService, familyAccessService } from '../services/api';
import { 
  Users, AlertTriangle, Calendar, Activity, CheckCircle2, 
  Clock, Plus, Phone, ArrowUpRight, Heart, ShieldAlert, Sparkles, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export const FamilyDashboard: React.FC = () => {
  const { setSelectedPatientId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Connect with passcode state
  const [shareCode, setShareCode] = useState('');
  const [relationship, setRelationship] = useState('Daughter');
  const [connectLoading, setConnectLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await dashboardService.getFamilyDashboard();
      setData(res);
      if (res.connected_patients && res.connected_patients.length > 0) {
        setSelectedPatientId(res.connected_patients[0].elder_id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load family dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareCode.trim()) return;
    setConnectLoading(true);
    try {
      await familyAccessService.connectPatient(shareCode, relationship);
      toast.success('Successfully linked to patient healthcare profile!');
      setShareCode('');
      await loadDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to connect. Check passcode.');
    } finally {
      setConnectLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-44 bg-slate-200/80 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-200/80 rounded-3xl" />
          <div className="h-48 bg-slate-200/80 rounded-3xl" />
        </div>
      </div>
    );
  }

  const { connected_patients, missed_dose_alerts, upcoming_appointments, recent_activities } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-sky-900 rounded-3xl p-7 sm:p-9 text-white shadow-card-elevated border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold mb-3 border border-sky-400/30">
            <Users className="w-3.5 h-3.5" /> Family Circle Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Family Care Monitor
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Real-time medication tracking, adherence metrics, and missed-dose alerts for your loved ones.
          </p>
        </div>

        <Link
          to="/ai-summary"
          className="px-4 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 shrink-0 relative z-10"
        >
          <Sparkles className="w-4 h-4" /> Grok AI Health Assessment
        </Link>
      </div>

      {/* Missed Dose Critical Alerts Banner */}
      {missed_dose_alerts && missed_dose_alerts.length > 0 && (
        <div className="p-5 rounded-3xl bg-red-50 border border-red-200/80 shadow-card flex items-start gap-4">
          <div className="p-2.5 rounded-2xl bg-red-100 text-red-600 shrink-0 border border-red-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-red-900">
                Active Missed Dose Alerts ({missed_dose_alerts.length})
              </h3>
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                Grace Window Exceeded
              </span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              The following scheduled doses were not confirmed within the 30-minute safety window:
            </p>
            <div className="mt-3 space-y-2">
              {missed_dose_alerts.map((al: any, idx: number) => (
                <div key={idx} className="text-xs bg-white p-3 rounded-xl border border-red-200 text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div>
                    <strong className="text-navy-950 font-extrabold">{al.elder_name}:</strong>{' '}
                    <span>{al.medication_name} ({al.dosage}) scheduled for <strong>{al.scheduled_time}</strong></span>
                  </div>
                  <Link to="/schedule" className="text-teal-600 font-bold hover:underline shrink-0 text-xs flex items-center gap-1">
                    Review Schedule <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monitored Elderly Profiles Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-navy-950 flex items-center gap-2">
            <Heart className="w-5 h-5 text-teal-600" /> Monitored Elderly Profiles
          </h2>
          <span className="text-xs font-semibold text-slate-400">
            {connected_patients.length} patient(s) linked
          </span>
        </div>

        {connected_patients.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200/80 text-center shadow-card">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-navy-950 text-sm">No elderly profiles connected yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Ask your loved one for their 6-digit passcode (e.g. CB-849201) to link their profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connected_patients.map((p: any) => (
              <div key={p.elder_id} className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80">
                      {p.relationship_label}
                    </span>
                    <h3 className="text-xl font-black text-navy-950 mt-2">{p.elder_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Conditions: {p.medical_conditions || 'None listed'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Today's Adherence</span>
                    <span className={`text-2xl font-black ${
                      p.today_adherence >= 80 ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {p.today_adherence}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Pending Doses</span>
                    <span className="font-black text-navy-950 text-base">{p.pending_doses_today}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Missed Doses</span>
                    <span className={`font-black text-base ${p.missed_doses_today > 0 ? 'text-red-600' : 'text-navy-950'}`}>
                      {p.missed_doses_today}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-500 font-medium">Emergency: {p.emergency_phone || 'None'}</span>
                  <Link
                    to="/history"
                    onClick={() => setSelectedPatientId(p.elder_id)}
                    className="font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    View Analytics <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect New Patient Form Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
        <h3 className="text-sm font-extrabold text-navy-950 flex items-center gap-2 mb-1">
          <Plus className="w-4 h-4 text-teal-600" /> Link Another Elderly Healthcare Profile
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Enter the unique passcode provided by the senior (e.g. CB-849201).
        </p>

        <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            placeholder="Passcode (e.g. CB-849201)"
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value.toUpperCase())}
            aria-label="Patient sharing passcode"
            className="px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono uppercase font-bold"
          />
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            aria-label="Relationship to patient"
            className="px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-700"
          >
            <option value="Daughter">Daughter</option>
            <option value="Son">Son</option>
            <option value="Spouse">Spouse</option>
            <option value="Grandchild">Grandchild</option>
            <option value="Sibling">Sibling</option>
            <option value="Guardian">Guardian</option>
          </select>
          <button
            type="submit"
            disabled={connectLoading}
            className="px-5 py-2.5 rounded-xl bg-navy-950 hover:bg-navy-900 text-white font-bold text-xs transition-all shadow-sm shrink-0"
          >
            {connectLoading ? 'Connecting...' : 'Authorize Link'}
          </button>
        </form>
      </div>

      {/* Upcoming Appointments & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Appointments */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-navy-950 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" /> Upcoming Medical Consultations
            </h3>
            <Link to="/appointments" className="text-xs font-bold text-teal-600 hover:underline">
              Manage
            </Link>
          </div>

          {upcoming_appointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No upcoming appointments recorded</p>
          ) : (
            <div className="space-y-3">
              {upcoming_appointments.map((appt: any) => (
                <div key={appt.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-navy-950 text-xs">{appt.doctor_name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
                      {appt.specialty}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{appt.clinic_hospital}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold text-teal-700">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{appt.appointment_date} at {appt.appointment_time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-navy-950 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" /> Recent Care Activity
            </h3>
            <Link to="/timeline" className="text-xs font-bold text-teal-600 hover:underline">
              Full Feed
            </Link>
          </div>

          <div className="space-y-3">
            {recent_activities.map((act: any) => (
              <div key={act.id} className="text-xs border-l-2 border-teal-500 pl-3 py-1">
                <p className="text-slate-700 leading-snug font-medium">{act.description}</p>
                <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                  {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
