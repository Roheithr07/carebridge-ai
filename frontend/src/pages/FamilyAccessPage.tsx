import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { familyAccessService } from '../services/api';
import { PatientAccess, ConnectedPatient } from '../types';
import { 
  Users, Copy, Check, 
  Trash2, Plus, RefreshCw, Phone, Heart
} from 'lucide-react';
import toast from 'react-hot-toast';

export const FamilyAccessPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [members, setMembers] = useState<PatientAccess[]>([]);
  const [patients, setPatients] = useState<ConnectedPatient[]>([]);
  const [shareCode, setShareCode] = useState<string>(user?.elderly_profile?.share_code || 'CB-849201');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Form for Family/Caregiver to link
  const [inputCode, setInputCode] = useState('');
  const [inputRelationship, setInputRelationship] = useState('Daughter');
  const [connecting, setConnecting] = useState(false);

  const isElder = user?.role === 'elderly';

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isElder) {
        const m = await familyAccessService.getConnectedMembers();
        setMembers(m);
        if (user?.elderly_profile?.share_code) {
          setShareCode(user.elderly_profile.share_code);
        }
      } else {
        const p = await familyAccessService.getConnectedPatients();
        setPatients(p);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load access authorizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    toast.success('Passcode copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (window.confirm('Regenerating your passcode will prevent any new connections using the old code. Existing active connections will remain safe. Proceed?')) {
      setRotating(true);
      try {
        const res = await familyAccessService.regenerateCode();
        setShareCode(res.new_share_code);
        await refreshUser();
        toast.success(`New passcode generated: ${res.new_share_code}`);
      } catch (e: any) {
        toast.error(e.response?.data?.detail || 'Failed to regenerate code');
      } finally {
        setRotating(false);
      }
    }
  };

  const handleRevoke = async (accessId: number, name: string) => {
    if (window.confirm(`Revoke healthcare access for ${name}? They will immediately lose access to your medications, adherence, and appointments.`)) {
      try {
        await familyAccessService.revokeAccess(accessId);
        toast.success(`Access revoked for ${name}`);
        await fetchData();
      } catch (e: any) {
        toast.error(e.response?.data?.detail || 'Failed to revoke access');
      }
    }
  };

  const handleConnectPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      toast.error('Please enter the 6-character sharing passcode');
      return;
    }
    setConnecting(true);
    try {
      await familyAccessService.connectPatient(inputCode.trim(), inputRelationship);
      toast.success('Successfully connected to patient healthcare profile!');
      setInputCode('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to connect. Check passcode.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" /> Family & Caregiver Authorization Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isElder
              ? 'Senior sovereignty control: Authorize loved ones or revoke third-party permissions immediately.'
              : 'Authorized healthcare profiles connected to your circle of care.'}
          </p>
        </div>
      </div>

      {/* Elder Sovereignty Passcode Box */}
      {isElder && (
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-teal-900 rounded-3xl p-7 sm:p-8 text-white shadow-card-elevated border border-slate-800/80 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div>
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider block mb-1">
                Your Private Sharing Passcode
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-white bg-navy-950/90 px-6 py-2.5 rounded-2xl border border-teal-400/40">
                  {shareCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-3.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white transition-all shadow-sm hover:scale-105 active:scale-95"
                  title="Copy Passcode"
                  aria-label="Copy Passcode"
                >
                  {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-white" />}
                </button>
              </div>
              <p className="text-xs text-slate-300 mt-2.5 max-w-lg leading-relaxed">
                Give this 6-digit code to family members or your nurse so they can monitor your adherence, assist with appointments, and receive automated email alerts.
              </p>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={rotating}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-all flex items-center gap-2 self-start sm:self-center shrink-0 active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              <span>{rotating ? 'Generating...' : 'Rotate / Generate New Code'}</span>
            </button>
          </div>
        </div>
      )}

      {/* If Family / Caregiver, show Connect Form */}
      {!isElder && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
          <h2 className="text-sm font-black text-navy-950 mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-600" /> Link an Elderly Individual's Profile
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Enter the 6-digit passcode provided by the senior (e.g. CB-849201) and specify your relationship.
          </p>

          <form onSubmit={handleConnectPatient} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="Passcode (e.g. CB-849201)"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              aria-label="Enter patient passcode"
              className="px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono uppercase font-bold flex-1"
            />
            <select
              value={inputRelationship}
              onChange={(e) => setInputRelationship(e.target.value)}
              aria-label="Relationship label"
              className="px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-700"
            >
              <option value="Daughter">Daughter</option>
              <option value="Son">Son</option>
              <option value="Spouse">Spouse</option>
              <option value="Grandchild">Grandchild</option>
              <option value="Visiting Home Nurse">Visiting Home Nurse</option>
              <option value="Primary Caregiver">Primary Caregiver</option>
              <option value="Other Relative">Other Relative</option>
            </select>
            <button
              type="submit"
              disabled={connecting}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-sm transition-all shrink-0 active:scale-95"
            >
              {connecting ? 'Connecting...' : 'Authorize Access'}
            </button>
          </form>
        </div>
      )}

      {/* Authorized Connections List */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
        <h2 className="text-sm font-black text-navy-950 uppercase tracking-wider text-slate-400 mb-4">
          {isElder ? 'Authorized Family & Caregivers' : 'Connected Elderly Patients'}
        </h2>

        {loading ? (
          <p className="text-xs text-slate-400 py-6 text-center">Loading authorizations...</p>
        ) : isElder ? (
          members.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No family members or caregivers are currently authorized. Share your code above to connect.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((m) => {
                const isRevoked = m.status === 'revoked';

                return (
                  <div key={m.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black text-sm shrink-0 border border-teal-100">
                        {m.user_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-navy-950 text-sm">{m.user_name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80">
                            {m.relationship_label}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {m.role}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isRevoked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {m.user_email} • Access granted {new Date(m.granted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {!isRevoked && (
                      <button
                        onClick={() => handleRevoke(m.id, m.user_name)}
                        className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors self-end sm:self-center flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Revoke Access
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          patients.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No elderly profiles linked. Use the form above to connect.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {patients.map((p) => (
                <div key={p.elder_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-navy-950 text-base">{p.elder_name}</h3>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        {p.relationship_label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                      {p.emergency_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {p.emergency_phone}
                        </span>
                      )}
                      {p.blood_group && (
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-400" /> Blood: {p.blood_group}
                        </span>
                      )}
                      {p.medical_conditions && (
                        <span>Conditions: {p.medical_conditions}</span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-center">
                    Authorized & Active
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

    </div>
  );
};
