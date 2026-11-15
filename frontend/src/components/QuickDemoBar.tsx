import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, User, Users, HeartHandshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QuickDemoBar: React.FC = () => {
  const { user, quickDemoLogin } = useAuth();
  const [switching, setSwitching] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSwitch = async (role: 'elderly' | 'family' | 'caregiver') => {
    setSwitching(role);
    try {
      const loggedInUser = await quickDemoLogin(role);
      if (loggedInUser.role === 'elderly') navigate('/elder/dashboard');
      else if (loggedInUser.role === 'family') navigate('/family/dashboard');
      else navigate('/caregiver/dashboard');
    } catch (e) {
      console.error('Failed to switch persona:', e);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="bg-[#0B1522] border-b border-slate-800/80 px-4 py-2 text-white text-xs flex flex-wrap items-center justify-between gap-3 shadow-md relative z-40">
      <div className="flex items-center gap-2.5">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
        </span>
        <div className="flex items-center gap-1.5 font-medium tracking-tight text-slate-300">
          <span className="text-teal-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Catalyst Hackathon:
          </span>
          <span className="hidden sm:inline">1-Click Persona Switcher for Evaluation</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => handleSwitch('elderly')}
          disabled={switching !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60 cursor-pointer ${
            user?.email === 'eleanor@carebridge.com'
              ? 'bg-teal-500 text-white font-bold shadow-glow-teal ring-1 ring-teal-300'
              : 'bg-navy-800/80 hover:bg-navy-700 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
          title="Switch to Eleanor Vance (Senior Individual)"
        >
          <User className="w-3.5 h-3.5 text-teal-300" />
          <span>{switching === 'elderly' ? 'Loading...' : 'Eleanor (Senior)'}</span>
        </button>

        <button
          onClick={() => handleSwitch('family')}
          disabled={switching !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60 cursor-pointer ${
            user?.email === 'sarah@carebridge.com'
              ? 'bg-sky-500 text-white font-bold ring-1 ring-sky-300'
              : 'bg-navy-800/80 hover:bg-navy-700 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
          title="Switch to Sarah Vance (Family Member)"
        >
          <Users className="w-3.5 h-3.5 text-sky-300" />
          <span>{switching === 'family' ? 'Loading...' : 'Sarah (Family)'}</span>
        </button>

        <button
          onClick={() => handleSwitch('caregiver')}
          disabled={switching !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60 cursor-pointer ${
            user?.email === 'david@carebridge.com'
              ? 'bg-emerald-500 text-white font-bold ring-1 ring-emerald-300'
              : 'bg-navy-800/80 hover:bg-navy-700 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
          title="Switch to Nurse David Miller (Caregiver)"
        >
          <HeartHandshake className="w-3.5 h-3.5 text-emerald-300" />
          <span>{switching === 'caregiver' ? 'Loading...' : 'David (Caregiver)'}</span>
        </button>
      </div>
    </div>
  );
};
