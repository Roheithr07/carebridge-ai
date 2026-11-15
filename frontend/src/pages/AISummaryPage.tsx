import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiSummaryService } from '../services/api';
import { AISummary } from '../types';
import { 
  Sparkles, CheckCircle2, AlertTriangle, Calendar, 
  ShieldAlert, RefreshCw, Heart, Check,
  HelpCircle, MessageSquareQuote, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AISummaryPage: React.FC = () => {
  const { user, selectedPatientId } = useAuth();
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetElderId = user?.role === 'elderly' ? undefined : (selectedPatientId || undefined);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiSummaryService.getSummary(targetElderId);
      setSummary(data);
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.detail || 'Failed to generate healthcare summary';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [targetElderId]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Hero Banner with Obsidian & Teal Groq Theme */}
      <div className="bg-[#0B1522] rounded-3xl p-7 sm:p-9 text-white shadow-card-elevated border border-slate-800 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-teal-500/20 via-sky-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Groq AI Clinical Synthesis Engine</span>
              <span className="text-[10px] bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded font-mono font-bold">
                Official Groq SDK
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              AI Healthcare Activity Summary
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              Synthesizes real-time medication adherence, detected missed doses, upcoming doctor appointments, and active regimens into verified caregiver insights.
            </p>
          </div>

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs transition-all flex items-center gap-2 self-start md:self-center shrink-0 shadow-glow-teal active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Synthesizing...' : 'Regenerate Insights'}</span>
          </button>
        </div>
      </div>

      {/* Safety Guardrail Notice */}
      <div className="p-4.5 rounded-3xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-extrabold text-amber-900">Clinical Safety & Non-Diagnostic Guardrail:</strong>{' '}
          CareBridge AI summaries strictly evaluate recorded tracking logs and do NOT diagnose diseases, prescribe medications, or adjust dosages. Always consult licensed healthcare professionals for medical care.
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 shadow-card">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-bold text-navy-950">Groq AI is synthesizing patient records...</p>
          <p className="text-xs text-slate-400 mt-1">Analyzing 7-day adherence metrics, missed-dose grace windows, and scheduled appointments</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="py-12 px-6 text-center bg-white rounded-3xl border border-red-200 shadow-card">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <h3 className="text-base font-black text-navy-950">Unable to Generate Summary</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
          <button
            onClick={fetchSummary}
            className="px-4 py-2 rounded-xl bg-navy-950 text-white font-bold text-xs"
          >
            Retry Generation
          </button>
        </div>
      )}

      {/* Content State */}
      {!loading && summary && (
        <div className="space-y-6">
          
          {/* Executive Overview Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Adherence Assessment
                </span>
                <h2 className="text-xl font-black text-navy-950 mt-0.5 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  {summary.adherence_assessment}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200/60 px-2.5 py-1 rounded-full font-mono font-bold">
                  {summary.provider || 'Groq AI Engine'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(summary.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4.5 rounded-2xl border border-slate-100 font-medium">
              {summary.summary_text}
            </p>
          </div>

          {/* Key Observations */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-card">
            <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" /> Key Clinical & Adherence Observations
            </h3>
            <ul className="space-y-3">
              {summary.key_observations.map((obs, i) => (
                <li key={i} className="text-xs sm:text-sm text-slate-700 flex items-start gap-3 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="h-2 w-2 rounded-full bg-teal-500 mt-1.5 shrink-0"></span>
                  <span className="font-medium leading-relaxed">{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Important Attention Points (if present) */}
          {summary.attention_points && summary.attention_points.length > 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/60 shadow-card bg-amber-50/10">
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Notable Attention Points
              </h3>
              <ul className="space-y-2.5">
                {summary.attention_points.map((pt, i) => (
                  <li key={i} className="text-xs text-slate-800 flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-amber-100 font-medium">
                    <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Physician Discussion Questions (if present) */}
          {summary.suggested_questions && summary.suggested_questions.length > 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-card">
              <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-teal-600" /> Questions to Discuss with Healthcare Provider
              </h3>
              <ul className="space-y-2.5">
                {summary.suggested_questions.map((q, i) => (
                  <li key={i} className="text-xs text-navy-950 flex items-start gap-3 bg-teal-50/40 p-3.5 rounded-2xl border border-teal-100/80 font-medium">
                    <HelpCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items & Caregiver Recommendations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Upcoming Actions */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
              <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" /> Upcoming Action Items
              </h3>
              <ul className="space-y-2">
                {summary.upcoming_action_items.map((act, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2.5 bg-sky-50/50 p-3.5 rounded-2xl border border-sky-100 font-medium">
                    <Check className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Caregiver Recommendations */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
              <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-teal-600" /> Caregiver Recommendations
              </h3>
              <ul className="space-y-2">
                {summary.caregiver_recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2.5 bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100 font-medium">
                    <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Regulatory Disclaimer Box */}
          <div className="bg-slate-100/90 p-4.5 rounded-3xl text-[11px] text-slate-500 leading-relaxed border border-slate-200/60">
            {summary.disclaimer}
          </div>

        </div>
      )}

    </div>
  );
};
