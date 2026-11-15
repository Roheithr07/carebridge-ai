import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/api';
import { Appointment, AppointmentStatus } from '../types';
import { 
  Calendar as CalendarIcon, Plus, Clock, MapPin, Building,
  Trash2, Edit2, X, Search, ChevronLeft, ChevronRight,
  Eye, Info, BellRing, CalendarDays
} from 'lucide-react';
import toast from 'react-hot-toast';

const SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Geriatrics',
  'Orthopedics',
  'Ophthalmology',
  'Endocrinology',
  'Dermatology',
  'Nephrology',
  'Pulmonology',
  'Other'
];

const VISIT_TYPES = [
  'Routine Consultation',
  'Follow-up Visit',
  'Lab / Diagnostic Test',
  'Specialist Review',
  'Prescription Refill',
  'Therapy / Rehabilitation',
  'Annual Checkup'
];

export const AppointmentsPage: React.FC = () => {
  const { user, selectedPatientId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calendar navigation state
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [viewingAppt, setViewingAppt] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [clinicHospital, setClinicHospital] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [roomDepartment, setRoomDepartment] = useState('');
  const [specialty, setSpecialty] = useState('Cardiology');
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [appointmentType, setAppointmentType] = useState('Routine Consultation');
  const [apptStatus, setApptStatus] = useState<AppointmentStatus>('scheduled');
  const [notes, setNotes] = useState('');

  const targetElderId = user?.role === 'elderly' ? undefined : (selectedPatientId || undefined);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await appointmentService.getAppointments(targetElderId, upcomingOnly);
      setAppointments(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [targetElderId, upcomingOnly]);

  // Calendar Helpers
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate days in month and start day offset
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedCalendarDate(today.toISOString().split('T')[0]);
  };

  // Group appointments by date string YYYY-MM-DD
  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      const d = a.appointment_date;
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [appointments]);

  const handleOpenAdd = (presetDate?: string) => {
    setEditingAppt(null);
    setDoctorName('');
    setClinicHospital('');
    setHospitalAddress('');
    setRoomDepartment('');
    setSpecialty('Cardiology');
    setAppointmentDate(presetDate || new Date().toISOString().split('T')[0]);
    setAppointmentTime('10:00');
    setAppointmentType('Routine Consultation');
    setApptStatus('scheduled');
    setNotes('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    setDoctorName(appt.doctor_name);
    setClinicHospital(appt.clinic_hospital);
    setHospitalAddress(appt.hospital_address || '');
    setRoomDepartment(appt.room_department || '');
    setSpecialty(appt.specialty || 'General Medicine');
    setAppointmentDate(appt.appointment_date);
    setAppointmentTime(appt.appointment_time);
    setAppointmentType(appt.appointment_type);
    setApptStatus(appt.status || 'scheduled');
    setNotes(appt.notes || '');
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim() || !clinicHospital.trim() || !appointmentDate || !appointmentTime) {
      toast.error('Please fill in all required appointment fields.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doctor_name: doctorName.trim(),
        clinic_hospital: clinicHospital.trim(),
        hospital_address: hospitalAddress.trim() || undefined,
        room_department: roomDepartment.trim() || undefined,
        specialty,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        appointment_type: appointmentType,
        status: apptStatus,
        notes: notes.trim() || undefined,
      };

      if (editingAppt) {
        await appointmentService.updateAppointment(editingAppt.id, payload);
        toast.success(`Appointment with Dr. ${doctorName} updated`);
      } else {
        await appointmentService.createAppointment(payload, targetElderId);
        toast.success(`Scheduled visit with Dr. ${doctorName}. Reminders armed!`);
      }
      setShowFormModal(false);
      await fetchAppointments();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (appt: Appointment) => {
    if (window.confirm(`Are you sure you want to cancel and remove the appointment with Dr. ${appt.doctor_name}?`)) {
      try {
        await appointmentService.deleteAppointment(appt.id);
        toast.success('Appointment cancelled');
        if (viewingAppt?.id === appt.id) setViewingAppt(null);
        await fetchAppointments();
      } catch (e) {
        toast.error('Failed to delete appointment');
      }
    }
  };

  // Filtered appointments list
  const filteredAppts = useMemo(() => {
    return appointments.filter(a => {
      const matchSearch =
        a.doctor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.clinic_hospital.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.specialty && a.specialty.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.hospital_address && a.hospital_address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDate = selectedCalendarDate ? a.appointment_date === selectedCalendarDate : true;

      return matchSearch && matchDate;
    });
  }, [appointments, searchQuery, selectedCalendarDate]);

  const todayStr = new Date().toISOString().split('T')[0];

  const getStatusBadge = (status: AppointmentStatus, isPast: boolean) => {
    if (status === 'cancelled') {
      return <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">Cancelled</span>;
    }
    if (status === 'completed' || isPast) {
      return <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Completed</span>;
    }
    return <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">Scheduled</span>;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-navy-950">
                Medical Appointment Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage clinical consultations, specialist reviews, and automated 24h & 2h advance notifications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search doctor or clinic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <button
            onClick={() => handleOpenAdd(selectedCalendarDate || undefined)}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Schedule Visit
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Calendar & Schedule Views */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Monthly Calendar (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-600" />
                <h2 className="text-base sm:text-lg font-black text-navy-950">
                  {monthNames[month]} {year}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleGoToday}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-navy-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-[11px] font-black uppercase tracking-wider text-slate-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Previous month trailing days */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => {
                const dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="h-14 sm:h-16 p-1.5 rounded-2xl bg-slate-50/50 border border-slate-100/60 text-slate-300 text-xs font-semibold flex flex-col justify-between select-none"
                  >
                    <span>{dayNum}</span>
                  </div>
                );
              })}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateKey === todayStr;
                const isSelected = dateKey === selectedCalendarDate;
                const dayAppts = apptsByDate[dateKey] || [];
                const hasAppts = dayAppts.length > 0;

                return (
                  <div
                    key={dateKey}
                    onClick={() => {
                      if (selectedCalendarDate === dateKey) {
                        setSelectedCalendarDate(null); // toggle off
                      } else {
                        setSelectedCalendarDate(dateKey);
                      }
                    }}
                    className={`h-14 sm:h-16 p-1.5 sm:p-2 rounded-2xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-navy-950 text-white border-navy-950 shadow-md ring-2 ring-teal-400'
                        : isToday
                        ? 'bg-teal-50/60 border-teal-300 text-teal-900 font-black'
                        : hasAppts
                        ? 'bg-white hover:bg-slate-50 border-teal-200 text-navy-950 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs ${isSelected ? 'font-black text-teal-300' : isToday ? 'font-black text-teal-700' : 'font-bold'}`}>
                        {dayNum}
                      </span>
                      {isToday && !isSelected && (
                        <span className="text-[9px] font-black uppercase text-teal-600 bg-teal-100/80 px-1 rounded-sm">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Appointment dots / badge */}
                    {hasAppts && (
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center justify-center text-[10px] font-black rounded-lg px-1.5 py-0.5 ${
                          isSelected
                            ? 'bg-teal-400 text-navy-950'
                            : 'bg-teal-500 text-white'
                        }`}>
                          {dayAppts.length} {dayAppts.length === 1 ? 'visit' : 'visits'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Footer Legend */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Has Appointment
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-100 border border-teal-400"></span> Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-navy-950"></span> Selected
              </span>
            </div>

            {selectedCalendarDate && (
              <button
                onClick={() => setSelectedCalendarDate(null)}
                className="text-teal-600 hover:text-teal-700 font-bold underline cursor-pointer"
              >
                Clear Date Filter
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Appointment Agenda / Selected Date List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Header of agenda */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-navy-950 uppercase tracking-wider">
                {selectedCalendarDate ? `Agenda for ${selectedCalendarDate}` : 'All Scheduled Consultations'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredAppts.length} {filteredAppts.length === 1 ? 'appointment' : 'appointments'} listed
              </p>
            </div>

            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={upcomingOnly}
                onChange={(e) => setUpcomingOnly(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              Upcoming only
            </label>
          </div>

          {/* Appointment cards list */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200/80 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredAppts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-card">
              <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-navy-950">No Appointments Found</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                {selectedCalendarDate
                  ? `No doctor visits scheduled on ${selectedCalendarDate}.`
                  : 'No upcoming visits match your current search or filter.'}
              </p>
              <button
                onClick={() => handleOpenAdd(selectedCalendarDate || undefined)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs transition-colors"
              >
                Schedule on this date
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {filteredAppts.map((appt) => {
                const isPast = new Date(appt.appointment_date) < new Date(todayStr);

                return (
                  <div
                    key={appt.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200/80">
                            {appt.specialty || 'General Medicine'}
                          </span>
                          <h3 
                            onClick={() => setViewingAppt(appt)}
                            className="text-base font-black text-navy-950 mt-1.5 hover:text-teal-600 cursor-pointer transition-colors"
                          >
                            {appt.doctor_name}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">{appt.appointment_type}</p>
                        </div>

                        {getStatusBadge(appt.status, isPast)}
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-navy-950 font-extrabold">
                          <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{appt.appointment_date} at {appt.appointment_time}</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{appt.clinic_hospital}</span>
                        </div>

                        {(appt.hospital_address || appt.room_department) && (
                          <div className="flex items-center gap-2 text-slate-500 text-[11px] pl-5">
                            <span className="truncate">
                              {appt.room_department ? `${appt.room_department} • ` : ''}
                              {appt.hospital_address || ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => setViewingAppt(appt)}
                        className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(appt)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                          title="Edit Appointment"
                          aria-label="Edit Appointment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(appt)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Cancel Appointment"
                          aria-label="Cancel Appointment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* Appointment Detail Modal */}
      {viewingAppt && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-card-elevated border border-slate-200/80 w-full max-w-lg p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {viewingAppt.specialty || 'General Medicine'}
                </span>
                <h2 className="text-xl font-black text-navy-950 mt-2">{viewingAppt.doctor_name}</h2>
                <p className="text-xs text-slate-500">{viewingAppt.appointment_type}</p>
              </div>
              <button 
                onClick={() => setViewingAppt(null)} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                <div className="flex items-center gap-2 text-navy-950 font-black">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>Scheduled: {viewingAppt.appointment_date} at {viewingAppt.appointment_time}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-700">
                  <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{viewingAppt.clinic_hospital}</p>
                    {viewingAppt.room_department && (
                      <p className="text-[11px] text-slate-500">Dept / Room: {viewingAppt.room_department}</p>
                    )}
                    {viewingAppt.hospital_address && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{viewingAppt.hospital_address}</p>
                    )}
                  </div>
                </div>
              </div>

              {viewingAppt.notes && (
                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100">
                  <h4 className="font-black text-navy-950 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-600" /> Preparation & Clinical Instructions:
                  </h4>
                  <p className="text-slate-700 font-medium leading-relaxed">{viewingAppt.notes}</p>
                </div>
              )}

              {/* Automated reminder indicator */}
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 flex items-center gap-3">
                <BellRing className="w-5 h-5 text-sky-600 shrink-0" />
                <p className="text-[11px] text-sky-900 leading-tight">
                  <strong>Automated Care Reminders:</strong> Notification sent 24 hours and 2 hours prior to this visit to the senior and authorized caregivers.
                </p>
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const appt = viewingAppt;
                  setViewingAppt(null);
                  handleDelete(appt);
                }}
                className="px-3.5 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Cancel Visit
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const appt = viewingAppt;
                    setViewingAppt(null);
                    handleOpenEdit(appt);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-navy-950 font-bold text-xs transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setViewingAppt(null)}
                  className="px-4 py-2 rounded-xl bg-navy-950 text-white font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Appointment Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-card-elevated border border-slate-200/80 w-full max-w-xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-navy-950 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-600" />
                {editingAppt ? 'Edit Appointment' : 'Schedule Doctor Visit'}
              </h2>
              <button 
                onClick={() => setShowFormModal(false)} 
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Doctor Name & Specialty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Doctor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Robert Hayes"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Medical Specialty <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {SPECIALTIES.map((spec) => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clinic / Hospital & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Clinic / Hospital <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mercy Medical Center"
                    value={clinicHospital}
                    onChange={(e) => setClinicHospital(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Room / Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cardiology Wing, Room 304"
                    value={roomDepartment}
                    onChange={(e) => setRoomDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              {/* Hospital Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Hospital / Clinic Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1200 Healthcare Blvd, Suite 400, Chicago, IL"
                  value={hospitalAddress}
                  onChange={(e) => setHospitalAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              {/* Visit Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Visit Type</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {VISIT_TYPES.map((vt) => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={apptStatus}
                    onChange={(e) => setApptStatus(e.target.value as AppointmentStatus)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Preparation / Clinical Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preparation & Clinical Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bring previous blood work, fasting for 8 hours required."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black text-xs shadow-sm active:scale-95 transition-all"
                >
                  {submitting ? 'Saving...' : editingAppt ? 'Update Appointment' : 'Confirm & Schedule'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
