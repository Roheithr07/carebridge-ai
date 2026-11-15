import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService, medicationService } from '../services/api';
import { 
  HeartHandshake, Users, AlertTriangle, Calendar, Activity, 
  CheckCircle2, Clock, Plus, Phone, Check, ArrowUpRight, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export const CaregiverDashboard: React.FC = () => {
  const { setSelectedPatientId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await dashboardService.getCaregiverDashboard();
      setData(res);
      if (res.assigned_patients && res.assigned_patients.length > 0) {
        setSelectedPatientId(res.assigned_patients[0].elder_id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load caregiver dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleDoseAction = async (dose: any, status: 'taken' | 'skipped') => {
    if (!dose.log_id) return;
    setActionLoading(dose.log_id);
    try {
      await medicationService.logDoseAction(dose.log_id, status);
      toast.success(`Caregiver verified dose as ${status.toUpperCase()}`);
      await loadDashboard();
    } catch (e) {
      toast.error('Failed to update dose');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-44 bg-slate-200/80 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200/80 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { assigned_patients, today_schedule, pending_doses, missed_doses } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-emerald-950 rounded-3xl p-7 sm:p-9 text-white shadow-card-elevated border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-3 border border-emerald-400/30">
            <HeartHandshake className="w-3.5 h-3.5" /> Caregiver Command Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Nurse & Caregiver Workspace
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Administer medication doses, monitor compliance, and coordinate care across all assigned patient profiles.
          </p>
        </div>

        <Link
          to="/ai-summary"
          className="px-4 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 shrink-0 relative z-10"
        >
          <Sparkles className="w-4 h-4" /> Grok Clinical Summary
        </Link>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Assigned Patients</span>
          <span className="text-2xl font-black text-navy-950 mt-1 block">{assigned_patients?.length || 0}</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's Scheduled</span>
          <span className="text-2xl font-black text-navy-950 mt-1 block">{today_schedule?.length || 0}</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Administration</span>
          <span className="text-2xl font-black text-amber-500 mt-1 block">{pending_doses?.length || 0}</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Overdue / Missed</span>
          <span className={`text-2xl font-black mt-1 block ${missed_doses?.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {missed_doses?.length || 0}
          </span>
        </div>
      </div>

      {/* Assigned Patient Profiles Grid */}
      <div>
        <h2 className="text-lg font-black text-navy-950 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" /> Authorized Patient Profiles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assigned_patients.map((p: any) => (
            <div key={p.elder_id} className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    {p.relationship_label}
                  </span>
                  <h3 className="text-lg font-black text-navy-950 mt-2">{p.elder_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Blood: {p.blood_group || 'N/A'} • Allergies: {p.allergies || 'None'}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Adherence</span>
                  <span className="text-xl font-black text-emerald-600">{p.today_adherence}%</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium truncate max-w-xs">Conditions: {p.medical_conditions || 'None'}</span>
                <Link
                  to="/schedule"
                  onClick={() => setSelectedPatientId(p.elder_id)}
                  className="font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 shrink-0"
                >
                  Manage Doses <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Patient Today's Medication Administration Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
        <h3 className="text-sm font-black text-navy-950 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" /> Today's Doses Requiring Clinical Verification
        </h3>
        {today_schedule.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">All doses are completed or none scheduled.</p>
        ) : (
          <div className="space-y-3">
            {today_schedule.map((dose: any, idx: number) => {
              const isTaken = dose.status === 'taken';
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-teal-700">{dose.elder_name}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-extrabold text-navy-950 text-sm">{dose.medication_name} ({dose.dosage})</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Scheduled: <strong>{dose.scheduled_time}</strong> • {dose.instructions || 'Standard dose'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isTaken ? (
                      <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified Administered
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDoseAction(dose, 'skipped')}
                          disabled={actionLoading === dose.log_id}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => handleDoseAction(dose, 'taken')}
                          disabled={actionLoading === dose.log_id}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm Given
                        </button>
                      </>
                    )}
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
