import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { 
  Settings, User, ShieldCheck, Heart, 
  Eye, Save, ShieldAlert 
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user, seniorMode, toggleSeniorMode, refreshUser } = useAuth();
  
  const profile = user?.elderly_profile;
  const isElder = user?.role === 'elderly';

  const [emergencyName, setEmergencyName] = useState(profile?.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone || '');
  const [bloodGroup, setBloodGroup] = useState(profile?.blood_group || 'O+');
  const [conditions, setConditions] = useState(profile?.medical_conditions || '');
  const [allergies, setAllergies] = useState(profile?.allergies || '');
  const [hospital, setHospital] = useState(profile?.preferred_hospital || '');
  const [notes, setNotes] = useState(profile?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isElder) return;
    setSaving(true);
    try {
      await authService.updateElderProfile({
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        blood_group: bloodGroup,
        medical_conditions: conditions,
        allergies,
        preferred_hospital: hospital,
        notes,
      });
      await refreshUser();
      toast.success('Healthcare profile updated successfully!');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
            <Settings className="w-6 h-6 text-teal-600" /> Account & Accessibility Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personalize accessibility modes, emergency contacts, and clinical health background.
          </p>
        </div>
      </div>

      {/* Accessibility Preferences Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
        <h2 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-500" /> Accessibility & Legibility
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div>
            <h3 className="font-extrabold text-navy-950 text-sm">Senior High-Contrast & Large Font Mode</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
              Enlarges buttons to at least 52px, sets base font size to 18.5px, and elevates contrast for clear visual readability for elderly individuals.
            </p>
          </div>

          <button
            onClick={toggleSeniorMode}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-xs shrink-0 active:scale-95 ${
              seniorMode
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {seniorMode ? 'Enabled (Turn Off)' : 'Enable Senior Mode'}
          </button>
        </div>
      </div>

      {/* User Account Info */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card">
        <h2 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-teal-600" /> Account Identity
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">Full Legal Name</span>
            <span className="font-black text-navy-950 text-sm mt-0.5 block">{user?.full_name}</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">Email Address</span>
            <span className="font-black text-navy-950 text-sm mt-0.5 block">{user?.email}</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">Assigned Role</span>
            <span className="font-black text-teal-700 text-sm mt-0.5 block capitalize">{user?.role}</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">Phone Number</span>
            <span className="font-black text-navy-950 text-sm mt-0.5 block">{user?.phone_number || 'Not provided'}</span>
          </div>
        </div>
      </div>

      {/* Elderly Profile Medical Details (if Senior) */}
      {isElder && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-navy-950 uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Emergency Contacts & Clinical Background
            </h2>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-xs flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="e.g. Sarah Vance (Daughter)"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Phone</label>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+1 (555) 234-5678"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-700"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Hospital / Clinic</label>
              <input
                type="text"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="Mercy Memorial Health Center"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Active Monitored Conditions</label>
            <input
              type="text"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="e.g. Hypertension, Type 2 Diabetes, Mild Osteoarthritis"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Known Drug Allergies</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Penicillin, Sulfa antibiotics"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Personal Daily Routine Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Prefers taking morning meds with warm oatmeal."
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>
        </form>
      )}

      {/* Safety Notice Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 text-xs text-slate-600 leading-relaxed flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-extrabold text-navy-950">CareBridge AI Platform Compliance & Security</strong>
          <p className="mt-1">
            CareBridge AI is designed to empower elderly users and their circles of care with adherence tracking and reminder automation. Personal healthcare profile access is restricted by unique passcodes, and all data operations are strictly logged in the auditable care timeline.
          </p>
        </div>
      </div>

    </div>
  );
};
