import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

export const MedicalSafetyBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-navy-900 border-b border-teal-500/30 text-slate-200 text-xs sm:text-sm py-2 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2 max-w-5xl mx-auto">
        <ShieldAlert className="w-4 h-4 text-teal-400 shrink-0" />
        <p className="leading-tight">
          <span className="font-semibold text-teal-300">Healthcare Notice:</span> CareBridge AI assists with medication tracking and routine coordination. It does not provide medical diagnoses, treatment modifications, or emergency dispatch services. Always consult a certified physician for medical advice.
        </p>
      </div>
      <button 
        onClick={() => setDismissed(true)} 
        aria-label="Dismiss banner"
        className="text-slate-400 hover:text-white transition-colors p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

