import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService, medicationService } from '../services/api';
import { 
  Pill, CheckCircle2, Clock, AlertTriangle, Calendar, 
  Share2, Copy, Check, Plus, ArrowUpRight, Shield, Heart,
  Phone, UserCheck, RefreshCw, XCircle, Sparkles, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DailyDoseItem } from '../types';
import toast from 'react-hot-toast';

export const ElderDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await dashboardService.getElderDashboard();
      setData(res);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleDoseAction = async (dose: DailyDoseItem, status: 'taken' | 'skipped') => {
    if (!dose.log_id) return;
    setActionLoading(dose.log_id);
    try {
      await medicationService.logDoseAction(dose.log_id, status);
      toast.success(status === 'taken' ? `Marked ${dose.medication_name} as Taken!` : `Dose skipped`);
      await loadDashboard();
    } catch (e) {
      toast.error('Failed to update dose');
    } finally {
      setActionLoading(null);
    }
  };

  const copyShareCode = () => {
    if (data?.profile?.share_code) {
      navigator.clipboard.writeText(data.profile.share_code);
      setCopied(true);
      toast.success('Share code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
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
        <div className="h-96 bg-slate-200/80 rounded-3xl" />
      </div>
    );
  }

  const { today_stats, daily_doses, adherence, upcoming_appointments, recent_activities } = data;
  const adherenceRate = adherence?.adherence_percentage ?? 100;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Welcome Banner with Apple Health Inspired Gradient */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-teal-900 rounded-3xl p-7 sm:p-9 text-white shadow-card-elevated border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold mb-3 border border-teal-400/30">
            <Heart className="w-3.5 h-3.5 fill-teal-400" /> Senior Care Command
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Good day, {data?.profile?.full_name || user?.full_name}!
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Your daily medication schedule and health routine. Your family and caregivers are keeping you supported.
          </p>
        </div>

        {/* Share Passcode Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4.5 w-full md:w-auto shrink-0 shadow-lg relative z-10">
          <div className="flex items-center justify-between gap-3 text-xs text-teal-200 mb-1.5">
            <span className="font-bold flex items-center gap-1.5 text-slate-200">
              <Share2 className="w-3.5 h-3.5 text-teal-400" /> Your Family Passcode:
            </span>
            <span className="text-[10px] bg-teal-500 text-white px-2.5 py-0.5 rounded-full font-bold">
              {data?.connected_members_count || 0} Connected
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-xl sm:text-2xl font-mono font-black tracking-widest text-white bg-navy-950/80 px-4 py-2 rounded-xl border border-teal-400/40">
              {data?.profile?.share_code || 'CB-849201'}
            </div>
            <button
              onClick={copyShareCode}
              className="p-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white transition-all shadow-sm flex items-center justify-center hover:scale-105 active:scale-95"
              title="Copy passcode to share with family or nurse"
            >
              {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-2">
            Share this code to authorize family members or your nurse.
          </p>
        </div>
      </div>

      {/* Quick KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Taken / Total */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's Doses</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-navy-950">{today_stats?.taken_doses || 0}</span>
              <span className="text-xs font-bold text-slate-400">/ {today_stats?.total_doses || 0} taken</span>
            </div>
          </div>
        </div>

        {/* Pending Today */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Today</span>
            <span className="text-2xl font-black text-navy-950 mt-0.5 block">
              {today_stats?.pending_doses || 0}
            </span>
          </div>
        </div>

        {/* Adherence Gauge */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Adherence Rate</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-emerald-600">
                {adherenceRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">({adherence?.trend || 'stable'})</span>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <Phone className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Emergency Contact</span>
            <span className="text-sm font-black text-navy-950 truncate block mt-0.5">
              {data?.profile?.emergency_contact_name || 'Designated Family'}
            </span>
            <span className="text-[11px] text-teal-600 font-bold">
              {data?.profile?.emergency_contact_phone || 'Call Support'}
            </span>
          </div>
        </div>

      </div>

      {/* Main Content Grid: Today's Schedule & Side Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Today's Medication Schedule (Big Senior-Friendly Buttons) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-navy-950 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-teal-600" /> Today's Medication Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm doses as you take them to automatically update your family
                </p>
              </div>
              <Link
                to="/schedule"
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                Full Day View <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {daily_doses.length === 0 ? (
              <div className="py-12 text-center">
                <Pill className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No medications scheduled for today</p>
                <Link
                  to="/medications"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline"
                >
                  <Plus className="w-4 h-4" /> Add your first medication
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {daily_doses.map((dose: DailyDoseItem, idx: number) => {
                  const isTaken = dose.status === 'taken';
                  const isSkipped = dose.status === 'skipped';
                  const isMissed = dose.status === 'missed';

                  return (
                    <div
                      key={idx}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        isTaken
                          ? 'bg-emerald-50/40 border-emerald-200/80'
                          : isMissed
                          ? 'bg-red-50/40 border-red-200/80'
                          : isSkipped
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white border-slate-200/80 hover:border-teal-300 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        
                        {/* Time & Med Info */}
                        <div className="flex items-start gap-3.5">
                          <div className={`p-2.5 rounded-2xl font-mono text-xs font-bold shrink-0 text-center min-w-[70px] ${
                            isTaken
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isMissed
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            <span className="block text-base leading-tight font-extrabold">{dose.scheduled_time}</span>
                            <span className="text-[10px] font-semibold uppercase">{dose.time_label || 'Dose'}</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-navy-950 text-base">{dose.medication_name}</h3>
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                                {dose.dosage}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                              {dose.instructions || 'Take with water according to prescription.'}
                            </p>
                          </div>
                        </div>

                        {/* Dose Actions (Accessible Big Buttons) */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {isTaken ? (
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-100/90 px-3.5 py-2 rounded-xl border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Taken
                            </div>
                          ) : isSkipped ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-200/80 px-3.5 py-2 rounded-xl">
                              <XCircle className="w-4 h-4" /> Skipped
                            </div>
                          ) : isMissed ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 px-3.5 py-2 rounded-xl border border-red-200">
                              <AlertTriangle className="w-4 h-4" /> Missed
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleDoseAction(dose, 'skipped')}
                                disabled={actionLoading === dose.log_id}
                                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-navy-950 hover:bg-slate-100 border border-slate-200 transition-colors"
                              >
                                Skip
                              </button>
                              <button
                                onClick={() => handleDoseAction(dose, 'taken')}
                                disabled={actionLoading === dose.log_id}
                                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-teal-500 hover:bg-teal-600 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                              >
                                <Check className="w-4 h-4" /> Take Now
                              </button>
                            </>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-3 gap-3">
            <Link
              to="/medications"
              className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover hover:border-teal-400 transition-all text-center flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-navy-950">Add Medication</span>
            </Link>

            <Link
              to="/appointments"
              className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover hover:border-teal-400 transition-all text-center flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-navy-950">Doctor Visits</span>
            </Link>

            <Link
              to="/ai-summary"
              className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover hover:border-teal-400 transition-all text-center flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-navy-950">Grok Summary</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Upcoming Appointments & Care Activity */}
        <div className="space-y-6">
          
          {/* Upcoming Appointments */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-navy-950 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" /> Upcoming Visits
              </h3>
              <Link to="/appointments" className="text-xs font-bold text-teal-600 hover:underline">
                View all
              </Link>
            </div>

            {upcoming_appointments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No upcoming appointments scheduled</p>
            ) : (
              <div className="space-y-3">
                {upcoming_appointments.map((appt: any) => (
                  <div key={appt.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-start justify-between">
                      <span className="font-extrabold text-navy-950 text-xs">{appt.doctor_name}</span>
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

          {/* Recent Healthcare Activity */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-navy-950 text-sm">Recent Activity</h3>
              <Link to="/timeline" className="text-xs font-bold text-teal-600 hover:underline">
                Timeline
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

    </div>
  );
};
