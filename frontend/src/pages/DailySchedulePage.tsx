import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { medicationService } from '../services/api';
import { DailyDoseItem } from '../types';
import { 
  CalendarClock, CheckCircle2, XCircle, AlertTriangle, 
  Clock, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pill
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DailySchedulePage: React.FC = () => {
  const { user, selectedPatientId } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [doses, setDoses] = useState<DailyDoseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'morning' | 'afternoon' | 'evening' | 'night'>('all');

  const targetElderId = user?.role === 'elderly' ? undefined : (selectedPatientId || undefined);

  const fetchDoses = async () => {
    setLoading(true);
    try {
      const data = await medicationService.getDailySchedule(targetElderId, selectedDate);
      setDoses(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load schedule for this date');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoses();
  }, [selectedDate, targetElderId]);

  const handleAction = async (dose: DailyDoseItem, status: 'taken' | 'skipped') => {
    if (!dose.log_id) return;
    setActionLoading(dose.log_id);
    try {
      await medicationService.logDoseAction(dose.log_id, status);
      toast.success(status === 'taken' ? `Marked ${dose.medication_name} as taken!` : `Dose skipped`);
      await fetchDoses();
    } catch (e) {
      toast.error('Failed to update dose');
    } finally {
      setActionLoading(null);
    }
  };

  const changeDateBy = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    setSelectedDate(curr.toISOString().split('T')[0]);
  };

  // Filter doses by time tab
  const filteredDoses = doses.filter((d) => {
    if (activeTab === 'all') return true;
    const hour = parseInt(d.scheduled_time.split(':')[0], 10);
    if (activeTab === 'morning') return hour >= 4 && hour < 12;
    if (activeTab === 'afternoon') return hour >= 12 && hour < 17;
    if (activeTab === 'evening') return hour >= 17 && hour < 21;
    if (activeTab === 'night') return hour >= 21 || hour < 4;
    return true;
  });

  const takenCount = doses.filter(d => d.status === 'taken').length;
  const missedCount = doses.filter(d => d.status === 'missed').length;
  const pendingCount = doses.filter(d => d.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header and Date Selector */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-teal-600" /> Daily Medication Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organized timeline of scheduled medication doses for the selected day.
          </p>
        </div>

        {/* Date Stepper */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => changeDateBy(-1)}
            className="p-2 rounded-xl hover:bg-white text-slate-600 hover:shadow-xs transition-all"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 px-3 font-bold text-xs sm:text-sm text-navy-950">
            <CalendarIcon className="w-4 h-4 text-teal-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Select medication schedule date"
              className="bg-transparent font-bold cursor-pointer focus:outline-none"
            />
          </div>

          <button
            onClick={() => changeDateBy(1)}
            className="p-2 rounded-xl hover:bg-white text-slate-600 hover:shadow-xs transition-all"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-xs"
          >
            Today
          </button>
        </div>
      </div>

      {/* Progress & Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taken</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-600 block mt-0.5">{takenCount}</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
          <span className="text-2xl sm:text-3xl font-black text-amber-500 block mt-0.5">{pendingCount}</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-card text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missed</span>
          <span className="text-2xl sm:text-3xl font-black text-red-500 block mt-0.5">{missedCount}</span>
        </div>
      </div>

      {/* Time-of-Day Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'morning', 'afternoon', 'evening', 'night'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold capitalize transition-all ${
              activeTab === tab
                ? 'bg-navy-950 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {tab === 'all' ? 'All Day' : tab}
          </button>
        ))}
      </div>

      {/* Dose Items Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200/80 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredDoses.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-950">No Doses Scheduled</h3>
          <p className="text-xs text-slate-500 mt-1">There are no medication doses for this filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDoses.map((dose, idx) => {
            const isTaken = dose.status === 'taken';
            const isSkipped = dose.status === 'skipped';
            const isMissed = dose.status === 'missed';

            return (
              <div
                key={idx}
                className={`bg-white rounded-3xl p-5 sm:p-6 border transition-all ${
                  isTaken
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isMissed
                    ? 'border-red-200 bg-red-50/20'
                    : 'border-slate-200/80 hover:border-teal-300 shadow-card'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Left: Time and Med details */}
                  <div className="flex items-start gap-4">
                    <div className="text-center font-mono font-bold bg-slate-100 p-2.5 rounded-2xl min-w-[76px] shrink-0 text-slate-800 border border-slate-200/60">
                      <span className="block text-base leading-none font-extrabold">{dose.scheduled_time}</span>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase mt-1 block">
                        {dose.time_label || 'Scheduled'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-navy-950 text-base">{dose.medication_name}</h3>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {dose.dosage}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {dose.instructions || 'Standard dosage instructions.'}
                      </p>
                      {dose.notes && (
                        <p className="text-[11px] text-amber-800 font-semibold mt-1 bg-amber-50 px-2 py-0.5 rounded-md inline-block border border-amber-200/60">
                          Note: {dose.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isTaken ? (
                      <span className="px-4 py-2.5 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5 border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Taken
                      </span>
                    ) : isSkipped ? (
                      <span className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-600 font-extrabold text-xs flex items-center gap-1.5 border border-slate-200">
                        <XCircle className="w-4 h-4" /> Skipped
                      </span>
                    ) : isMissed ? (
                      <span className="px-4 py-2.5 rounded-2xl bg-red-100 text-red-700 font-extrabold text-xs flex items-center gap-1.5 border border-red-200">
                        <AlertTriangle className="w-4 h-4 text-red-600" /> Missed
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAction(dose, 'skipped')}
                          disabled={actionLoading === dose.log_id}
                          className="px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => handleAction(dose, 'taken')}
                          disabled={actionLoading === dose.log_id}
                          className="px-5 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
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
  );
};
