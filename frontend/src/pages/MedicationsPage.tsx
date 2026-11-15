import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { medicationService } from '../services/api';
import { Medication } from '../types';
import { 
  Pill, Plus, Edit2, Trash2, Clock, 
  User, X, ShieldAlert, Check, Search, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

export const MedicationsPage: React.FC = () => {
  const { user, selectedPatientId } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [instructions, setInstructions] = useState('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);

  const targetElderId = user?.role === 'elderly' ? undefined : (selectedPatientId || undefined);

  const fetchMeds = async () => {
    setLoading(true);
    try {
      const data = await medicationService.getMedications(targetElderId);
      setMedications(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeds();
  }, [targetElderId]);

  const handleOpenAdd = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setFrequency('Daily');
    setInstructions('');
    setPrescribingDoctor('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setTimes(['08:00']);
    setShowModal(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setFrequency(med.frequency);
    setInstructions(med.instructions || '');
    setPrescribingDoctor(med.prescribing_doctor || '');
    setStartDate(med.start_date || '');
    setEndDate(med.end_date || '');
    setShowModal(true);
  };

  const handleAddTimeSlot = () => {
    setTimes([...times, '12:00']);
  };

  const handleRemoveTimeSlot = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMed) {
        await medicationService.updateMedication(editingMed.id, {
          name,
          dosage,
          frequency,
          instructions,
          prescribing_doctor: prescribingDoctor,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        });
        toast.success('Medication details updated successfully');
      } else {
        const schedules = times.map((t) => ({
          time_of_day: t,
          label: parseInt(t.split(':')[0]) < 12 ? 'Morning' : parseInt(t.split(':')[0]) < 17 ? 'Afternoon' : 'Evening',
          days_of_week: 'all',
          dose_quantity: '1 dose',
        }));

        await medicationService.createMedication(
          {
            name,
            dosage,
            frequency,
            instructions,
            prescribing_doctor: prescribingDoctor,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            schedules,
          },
          targetElderId
        );
        toast.success('New medication added to schedule!');
      }
      setShowModal(false);
      await fetchMeds();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save medication');
    }
  };

  const handleDelete = async (med: Medication) => {
    if (window.confirm(`Are you sure you want to remove ${med.name} from active medications?`)) {
      try {
        await medicationService.deleteMedication(med.id);
        toast.success(`Removed ${med.name}`);
        await fetchMeds();
      } catch (e) {
        toast.error('Failed to delete medication');
      }
    }
  };

  const filteredMeds = medications.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.prescribing_doctor && m.prescribing_doctor.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 flex items-center gap-2">
            <Pill className="w-6 h-6 text-teal-600" /> Prescribed Medications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active prescriptions, dosages, administration times, and prescribing doctor records.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search medication..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Med
          </button>
        </div>
      </div>

      {/* Medication List Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-60 bg-slate-200/80 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredMeds.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-950">No Medications Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Add your prescribed medications to generate daily schedules automatically.</p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-navy-950 text-white font-bold text-xs"
          >
            Add First Medication
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeds.map((med) => (
            <div
              key={med.id}
              className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black text-navy-950">{med.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80">
                        {med.dosage}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{med.frequency}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    med.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {med.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed font-medium">
                  {med.instructions || 'Standard dosage instructions.'}
                </p>

                {/* Schedules */}
                <div className="mt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Daily Schedule Slots
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {med.schedules && med.schedules.length > 0 ? (
                      med.schedules.map((s) => (
                        <span
                          key={s.id}
                          className="px-3 py-1 rounded-xl bg-slate-100 text-navy-950 font-mono text-xs font-bold border border-slate-200 flex items-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5 text-teal-600" />
                          {s.time_of_day} <span className="text-slate-400 font-sans font-medium text-[11px]">({s.label})</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No specific times set</span>
                    )}
                  </div>
                </div>

                {med.prescribing_doctor && (
                  <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Prescribed by: <strong className="text-navy-950">{med.prescribing_doctor}</strong></span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(med)}
                  className="p-2 rounded-xl text-slate-400 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                  title="Edit Medication"
                  aria-label="Edit Medication"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(med)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete Medication"
                  aria-label="Delete Medication"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-card-elevated border border-slate-200/80 w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-navy-950">
                {editingMed ? 'Edit Medication Details' : 'Add New Prescription'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-xl text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Medication Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lisinopril"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10mg / 1 tablet"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Once daily / Twice daily"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              {!editingMed && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">Daily Administration Times</label>
                    <button
                      type="button"
                      onClick={handleAddTimeSlot}
                      className="text-xs font-bold text-teal-600 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Slot
                    </button>
                  </div>
                  <div className="space-y-2">
                    {times.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={t}
                          onChange={(e) => {
                            const newTimes = [...times];
                            newTimes[i] = e.target.value;
                            setTimes(newTimes);
                          }}
                          className="px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-bold"
                        />
                        {times.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTimeSlot(i)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Patient Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Take immediately after breakfast with a full glass of water."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prescribing Doctor</label>
                  <input
                    type="text"
                    placeholder="Dr. Robert Hayes"
                    value={prescribingDoctor}
                    onChange={(e) => setPrescribingDoctor(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-sm active:scale-95 transition-all"
                >
                  {editingMed ? 'Save Changes' : 'Create Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
