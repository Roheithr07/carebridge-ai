from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.models import (
    UserRole, MedicationStatus, DoseStatus, 
    AppointmentStatus, AccessStatus, NotificationType, ActionType
)


# ================= User & Auth Schemas =================
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone_number: Optional[str] = None
    role: UserRole


class UserRegister(UserBase):
    password: str = Field(..., min_length=6)
    # Optional fields for elderly profile creation during signup
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class ElderlyProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    share_code: str
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    preferred_hospital: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class ElderlyProfileUpdate(BaseModel):
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    preferred_hospital: Optional[str] = None
    notes: Optional[str] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    elderly_profile: Optional[ElderlyProfileResponse] = None


# ================= Medication Schemas =================
class ScheduleItemCreate(BaseModel):
    time_of_day: str = Field(..., description="e.g. '08:00', '13:00', '20:00'")
    label: Optional[str] = Field(None, description="e.g. 'Morning', 'Evening'")
    days_of_week: Optional[str] = "all"
    dose_quantity: Optional[str] = "1 dose"


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication_id: int
    elder_id: int
    time_of_day: str
    label: Optional[str] = None
    days_of_week: str
    dose_quantity: str
    is_active: bool


class MedicationCreate(BaseModel):
    name: str
    dosage: str
    frequency: str
    instructions: Optional[str] = None
    prescribing_doctor: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    schedules: List[ScheduleItemCreate] = []


class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    instructions: Optional[str] = None
    prescribing_doctor: Optional[str] = None
    status: Optional[MedicationStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class MedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    name: str
    dosage: str
    frequency: str
    instructions: Optional[str] = None
    prescribing_doctor: Optional[str] = None
    status: MedicationStatus
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    schedules: List[ScheduleResponse] = []


# ================= Medication Dose & Log Schemas =================
class DoseActionRequest(BaseModel):
    status: DoseStatus = Field(..., description="'taken', 'skipped', or 'missed'")
    notes: Optional[str] = None


class MedicationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication_id: int
    schedule_id: Optional[int] = None
    elder_id: int
    scheduled_date: date
    scheduled_time: str
    status: DoseStatus
    action_time: Optional[datetime] = None
    action_by_user_id: Optional[int] = None
    notes: Optional[str] = None
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    time_label: Optional[str] = None


class DailyDoseItem(BaseModel):
    log_id: Optional[int] = None
    medication_id: int
    medication_name: str
    dosage: str
    instructions: Optional[str] = None
    schedule_id: Optional[int] = None
    scheduled_time: str
    time_label: Optional[str] = None
    scheduled_date: date
    status: DoseStatus # taken, skipped, missed, pending
    action_time: Optional[datetime] = None
    notes: Optional[str] = None


class AdherenceStats(BaseModel):
    adherence_percentage: float
    total_scheduled: int
    taken_count: int
    skipped_count: int
    missed_count: int
    pending_count: int
    daily_history: List[Dict[str, Any]] = []
    weekly_history: List[Dict[str, Any]] = []
    trend: str = "stable"


# ================= Appointment Schemas =================
class AppointmentCreate(BaseModel):
    doctor_name: str
    clinic_hospital: str
    specialty: Optional[str] = "General"
    appointment_date: date
    appointment_time: str
    hospital_address: Optional[str] = None
    room_department: Optional[str] = None
    appointment_type: Optional[str] = "Checkup"
    notes: Optional[str] = None
    status: Optional[AppointmentStatus] = AppointmentStatus.SCHEDULED


class AppointmentUpdate(BaseModel):
    doctor_name: Optional[str] = None
    clinic_hospital: Optional[str] = None
    specialty: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    hospital_address: Optional[str] = None
    room_department: Optional[str] = None
    appointment_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[AppointmentStatus] = None


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    created_by_user_id: Optional[int] = None
    doctor_name: str
    clinic_hospital: str
    specialty: Optional[str] = None
    appointment_date: date
    appointment_time: str
    hospital_address: Optional[str] = None
    room_department: Optional[str] = None
    appointment_type: str
    notes: Optional[str] = None
    status: AppointmentStatus
    created_at: datetime


# ================= Patient Access & Sharing Schemas =================
class ConnectAccessRequest(BaseModel):
    share_code: str = Field(..., description="Unique passcode of elderly individual")
    relationship_label: str = Field(..., description="e.g. 'Daughter', 'Son', 'Primary Nurse'")


class PatientAccessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    user_id: int
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    relationship_label: str
    role: UserRole
    status: AccessStatus
    permissions: str
    granted_at: datetime
    revoked_at: Optional[datetime] = None


class ConnectedPatientResponse(BaseModel):
    elder_id: int
    elder_user_id: int
    elder_name: str
    elder_phone: Optional[str] = None
    relationship_label: str
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    today_adherence: float = 0.0
    pending_doses_today: int = 0
    missed_doses_today: int = 0
    next_appointment: Optional[AppointmentResponse] = None


# ================= Notification Schemas =================
class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    elder_id: Optional[int] = None
    title: str
    description: str
    notification_type: NotificationType
    is_read: bool
    metadata_json: Optional[str] = None
    created_at: datetime


# ================= Activity Log Schemas =================
class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action_type: ActionType
    description: str
    details_json: Optional[str] = None
    created_at: datetime


# ================= AI Summary Schemas =================
class AISummaryResponse(BaseModel):
    title: str
    summary_text: str
    adherence_assessment: str
    key_observations: List[str]
    upcoming_action_items: List[str]
    caregiver_recommendations: List[str]
    attention_points: Optional[List[str]] = None
    suggested_questions: Optional[List[str]] = None
    disclaimer: str
    provider: str = "Groq AI Assistant"
    generated_at: datetime

