export type UserRole = 'elderly' | 'family' | 'caregiver';

export type MedicationStatus = 'active' | 'completed' | 'discontinued';
export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'missed';
export type AccessStatus = 'active' | 'revoked';
export type NotificationType = 'medication_reminder' | 'missed_dose' | 'appointment_reminder' | 'care_update' | 'access_alert';
export type ActionType = 
  | 'medication_added'
  | 'medication_updated'
  | 'medication_deleted'
  | 'dose_taken'
  | 'dose_skipped'
  | 'missed_dose_detected'
  | 'appointment_created'
  | 'appointment_updated'
  | 'appointment_cancelled'
  | 'access_granted'
  | 'access_revoked'
  | 'care_note_added';

export interface ElderlyProfile {
  id: number;
  user_id: number;
  share_code: string;
  date_of_birth?: string;
  blood_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_conditions?: string;
  allergies?: string;
  preferred_hospital?: string;
  notes?: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone_number?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  elderly_profile?: ElderlyProfile;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ScheduleItem {
  id: number;
  medication_id: number;
  elder_id: number;
  time_of_day: string;
  label?: string;
  days_of_week: string;
  dose_quantity: string;
  is_active: boolean;
}

export interface Medication {
  id: number;
  elder_id: number;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribing_doctor?: string;
  status: MedicationStatus;
  start_date?: string;
  end_date?: string;
  created_at: string;
  schedules: ScheduleItem[];
}

export interface DailyDoseItem {
  log_id?: number;
  medication_id: number;
  medication_name: string;
  dosage: string;
  instructions?: string;
  schedule_id?: number;
  scheduled_time: string;
  time_label?: string;
  scheduled_date: string;
  status: DoseStatus;
  action_time?: string;
  notes?: string;
}

export interface MedicationLog {
  id: number;
  medication_id: number;
  schedule_id?: number;
  elder_id: number;
  scheduled_date: string;
  scheduled_time: string;
  status: DoseStatus;
  action_time?: string;
  action_by_user_id?: number;
  notes?: string;
  medication_name?: string;
  dosage?: string;
  time_label?: string;
}

export interface AdherenceDay {
  date: string;
  label: string;
  adherence_rate: number;
  taken: number;
  skipped: number;
  missed: number;
  total_due: number;
}

export interface AdherenceWeek {
  week_label: string;
  adherence_rate: number;
  taken: number;
  total_due: number;
}

export interface AdherenceStats {
  adherence_percentage: number;
  total_scheduled: number;
  taken_count: number;
  skipped_count: number;
  missed_count: number;
  pending_count: number;
  daily_history: AdherenceDay[];
  weekly_history: AdherenceWeek[];
  trend: 'improving' | 'declining' | 'stable';
}

export interface Appointment {
  id: number;
  elder_id: number;
  created_by_user_id?: number;
  doctor_name: string;
  clinic_hospital: string;
  specialty?: string;
  appointment_date: string;
  appointment_time: string;
  hospital_address?: string;
  room_department?: string;
  appointment_type: string;
  notes?: string;
  status: AppointmentStatus;
  created_at: string;
}

export interface PatientAccess {
  id: number;
  elder_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_phone?: string;
  relationship_label: string;
  role: UserRole;
  status: AccessStatus;
  permissions: string;
  granted_at: string;
  revoked_at?: string;
}

export interface ConnectedPatient {
  elder_id: number;
  elder_user_id: number;
  elder_name: string;
  elder_phone?: string;
  relationship_label: string;
  blood_group?: string;
  medical_conditions?: string;
  allergies?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  today_adherence: number;
  pending_doses_today: number;
  missed_doses_today: number;
  next_appointment?: Appointment;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  elder_id?: number;
  title: string;
  description: string;
  notification_type: NotificationType;
  is_read: boolean;
  metadata_json?: string;
  created_at: string;
}

export interface ActivityItem {
  id: number;
  elder_id: number;
  user_id?: number;
  user_name?: string;
  action_type: ActionType;
  description: string;
  details_json?: string;
  created_at: string;
}

export interface AISummary {
  title: string;
  summary_text: string;
  adherence_assessment: string;
  key_observations: string[];
  upcoming_action_items: string[];
  caregiver_recommendations: string[];
  attention_points?: string[];
  suggested_questions?: string[];
  disclaimer: string;
  provider?: string;
  generated_at: string;
}
