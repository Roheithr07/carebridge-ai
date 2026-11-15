import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adherenceService } from '../services/api';
import { AdherenceStats, MedicationLog } from '../types';
import { 
  History, TrendingUp, TrendingDown, Minus, Filter,
  Calculator, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Legend, LineChart, Line, CartesianGrid 
} from 'recharts';
import toast from 'react-hot-toast';

export const AdherenceHistoryPage: React.FC = () => {
  const { user, selectedPatientId } = useAuth();
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [daysBack, setDaysBack] = useState<number>(14);

  const targetElderId = user?.role === 'elderly' ? undefined : (selectedPatientId || undefined);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, lData] = await Promise.all([
        adherenceService.getAdherenceStats(targetElderId, daysBack),
        adherenceService.getMedicationLogs(targetElderId, statusFilter || undefined)
      ]);
      setStats(sData);
      setLogs(lData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load adherence analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [targetElderId, statusFilter, daysBack]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
            <History className="w-6 h-6 text-teal-600" /> Medication Adherence Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Mathematical compliance tracking, daily distribution, and long-term trend analysis.
          </p>
        </div>

        {/* Evaluation Window Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Window:</span>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            aria-label="Adherence evaluation window"
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value={7}>Past 7 Days</option>
            <option value={14}>Past 14 Days</option>
            <option value={30}>Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* KPI Formula & Metrics Breakdown */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200/80 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Adherence Rate</span>
              {stats.trend === 'improving' ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Improving
                </span>
              ) : stats.trend === 'declining' ? (
                <span className="text-xs font-bold text-red-500 flex items-center gap-0.5">
                  <TrendingDown className="w-3.5 h-3.5" /> Declining
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-500 flex items-center gap-0.5">
                  <Minus className="w-3.5 h-3.5" /> Stable
                </span>
              )}
            </div>
            <span className="text-3xl font-black text-navy-950 mt-1 block">
              {stats.adherence_percentage}%
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
              ({stats.taken_count} taken / {stats.total_scheduled} scheduled past)
            </span>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Doses Taken</span>
            <span className="text-3xl font-black text-emerald-600 mt-1 block">{stats.taken_count}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Confirmed taken</span>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Doses Skipped</span>
            <span className="text-3xl font-black text-slate-600 mt-1 block">{stats.skipped_count}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Clinically omitted</span>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Doses Missed</span>
            <span className="text-3xl font-black text-red-500 mt-1 block">{stats.missed_count}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Exceeded grace window</span>
          </div>
        </div>
      )}

      {/* Visual Charts: Daily Dose Breakdown & Adherence Trend Line */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Daily Doses Bar Chart */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-card">
            <h3 className="text-sm font-extrabold text-navy-950 mb-1">Daily Dose Distribution</h3>
            <p className="text-xs text-slate-400 mb-5">Comparison of doses taken, skipped, and missed per day</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.daily_history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #E2E8F0', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      fontSize: '11px',
                      fontWeight: 600
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="taken" fill="#14B8A6" name="Taken" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="skipped" fill="#94A3B8" name="Skipped" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="missed" fill="#EF4444" name="Missed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Adherence Rate Line Chart */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-card">
            <h3 className="text-sm font-extrabold text-navy-950 mb-1">Adherence Rate Trend (%)</h3>
            <p className="text-xs text-slate-400 mb-5">Adherence percentage over time (target ≥ 80%)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.daily_history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #E2E8F0', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      fontSize: '11px',
                      fontWeight: 600
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="adherence_rate" 
                    stroke="#14243A" 
                    strokeWidth={3} 
                    dot={{ fill: '#14B8A6', r: 4, strokeWidth: 2, stroke: '#FFFFFF' }} 
                    activeDot={{ r: 6, fill: '#14B8A6' }}
                    name="Adherence %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* Detailed Logbook Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-black text-navy-950">Dose Administration Logbook</h3>
            <p className="text-xs text-slate-400">Complete audit trail of every scheduled dose and recorded action.</p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter logbook by dose status"
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="taken">Taken</option>
              <option value="skipped">Skipped</option>
              <option value="missed">Missed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">No logs match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Medication</th>
                  <th className="py-3 px-3">Dosage</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Action Time</th>
                  <th className="py-3 px-3">Clinical Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isTaken = log.status === 'taken';
                  const isSkipped = log.status === 'skipped';
                  const isMissed = log.status === 'missed';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {log.scheduled_date} <span className="text-slate-400 font-medium">({log.scheduled_time})</span>
                      </td>
                      <td className="py-3 px-3 font-black text-navy-950">{log.medication_name}</td>
                      <td className="py-3 px-3 font-medium text-slate-600">{log.dosage}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          isTaken
                            ? 'bg-emerald-100 text-emerald-800'
                            : isMissed
                            ? 'bg-red-100 text-red-800'
                            : isSkipped
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {log.action_time ? new Date(log.action_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate font-medium">
                        {log.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
