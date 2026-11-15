import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, ForeignKey, 
    Text, Enum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    ELDERLY = "elderly"
    FAMILY = "family"
    CAREGIVER = "caregiver"


class MedicationStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DISCONTINUED = "discontinued"


class DoseStatus(str, enum.Enum):
    PENDING = "pending"
    TAKEN = "taken"
    SKIPPED = "skipped"
    MISSED = "missed"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    MISSED = "missed"


class AccessStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING = "pending"
    REVOKED = "revoked"


class NotificationType(str, enum.Enum):
    MEDICATION_REMINDER = "medication_reminder"
    MISSED_DOSE = "missed_dose"
    APPOINTMENT_REMINDER = "appointment_reminder"
    CARE_UPDATE = "care_update"
    ACCESS_ALERT = "access_alert"


class ActionType(str, enum.Enum):
    MEDICATION_ADDED = "medication_added"
    MEDICATION_UPDATED = "medication_updated"
    MEDICATION_DELETED = "medication_deleted"
    DOSE_TAKEN = "dose_taken"
    DOSE_SKIPPED = "dose_skipped"
    MISSED_DOSE_DETECTED = "missed_dose_detected"
    APPOINTMENT_CREATED = "appointment_created"
    APPOINTMENT_UPDATED = "appointment_updated"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    ACCESS_GRANTED = "access_granted"
    ACCESS_REVOKED = "access_revoked"
    CARE_NOTE_ADDED = "care_note_added"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone_number = Column(String(50), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ELDERLY)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    elderly_profile = relationship("ElderlyProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    patient_accesses = relationship("PatientAccess", back_populates="authorized_user", foreign_keys="PatientAccess.user_id", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class ElderlyProfile(Base):
    __tablename__ = "elderly_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    share_code = Column(String(32), unique=True, index=True, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    blood_group = Column(String(10), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    medical_conditions = Column(Text, nullable=True) # JSON or comma-separated
    allergies = Column(Text, nullable=True)
    preferred_hospital = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="elderly_profile")
    medications = relationship("Medication", back_populates="elder", cascade="all, delete-orphan")
    schedules = relationship("MedicationSchedule", back_populates="elder", cascade="all, delete-orphan")
    medication_logs = relationship("MedicationLog", back_populates="elder", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="elder", cascade="all, delete-orphan")
    accesses = relationship("PatientAccess", back_populates="elder", foreign_keys="PatientAccess.elder_id", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="elder", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="elder", cascade="all, delete-orphan")


class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    dosage = Column(String(100), nullable=False) # e.g. "10mg", "1 tablet"
    frequency = Column(String(100), nullable=False) # e.g. "Daily", "Twice daily"
    instructions = Column(Text, nullable=True) # e.g. "Take after breakfast with plenty of water"
    prescribing_doctor = Column(String(255), nullable=True)
    status = Column(Enum(MedicationStatus), default=MedicationStatus.ACTIVE, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    elder = relationship("ElderlyProfile", back_populates="medications")
    schedules = relationship("MedicationSchedule", back_populates="medication", cascade="all, delete-orphan")
    logs = relationship("MedicationLog", back_populates="medication", cascade="all, delete-orphan")


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id", ondelete="CASCADE"), nullable=False, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    time_of_day = Column(String(10), nullable=False) # "08:00", "13:00", "20:00"
    label = Column(String(50), nullable=True) # "Morning", "Afternoon", "Evening", "Night"
    days_of_week = Column(String(50), default="all") # "all" or comma separated "1,2,3,4,5,6,7"
    dose_quantity = Column(String(50), default="1 dose")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    medication = relationship("Medication", back_populates="schedules")
    elder = relationship("ElderlyProfile", back_populates="schedules")
    logs = relationship("MedicationLog", back_populates="schedule", cascade="all, delete-orphan")


class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id = Column(Integer, ForeignKey("medication_schedules.id", ondelete="SET NULL"), nullable=True, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_date = Column(Date, nullable=False, index=True)
    scheduled_time = Column(String(10), nullable=False) # e.g. "08:00"
    status = Column(Enum(DoseStatus), default=DoseStatus.PENDING, nullable=False, index=True)
    action_time = Column(DateTime, nullable=True) # When it was actually taken or skipped
    action_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint('medication_id', 'schedule_id', 'scheduled_date', 'scheduled_time', name='uix_med_schedule_date_time'),
        Index('ix_med_log_elder_date', 'elder_id', 'scheduled_date'),
    )

    # Relationships
    medication = relationship("Medication", back_populates="logs")
    schedule = relationship("MedicationSchedule", back_populates="logs")
    elder = relationship("ElderlyProfile", back_populates="medication_logs")
    action_by_user = relationship("User", foreign_keys=[action_by_user_id])


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    doctor_name = Column(String(255), nullable=False)
    clinic_hospital = Column(String(255), nullable=False)
    specialty = Column(String(100), nullable=True)
    appointment_date = Column(Date, nullable=False, index=True)
    appointment_time = Column(String(10), nullable=False) # e.g. "10:30"
    hospital_address = Column(String(255), nullable=True)
    room_department = Column(String(100), nullable=True)
    appointment_type = Column(String(100), default="General Checkup") # e.g. "Cardiology", "Routine Checkup"
    notes = Column(Text, nullable=True)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED, nullable=False, index=True)
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    elder = relationship("ElderlyProfile", back_populates="appointments")
    created_by = relationship("User", foreign_keys=[created_by_user_id])


class PatientAccess(Base):
    __tablename__ = "patient_access"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_label = Column(String(100), nullable=False) # e.g. "Daughter", "Son", "Primary Nurse"
    role = Column(Enum(UserRole), nullable=False) # family or caregiver
    status = Column(Enum(AccessStatus), default=AccessStatus.ACTIVE, nullable=False)
    permissions = Column(String(50), default="view_and_manage") # "view_only", "view_and_manage"
    access_code_used = Column(String(32), nullable=True)
    granted_at = Column(DateTime, default=utc_now)
    revoked_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint('elder_id', 'user_id', name='uix_elder_user_access'),
    )

    # Relationships
    elder = relationship("ElderlyProfile", back_populates="accesses", foreign_keys=[elder_id])
    authorized_user = relationship("User", back_populates="patient_accesses", foreign_keys=[user_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False, index=True)
    is_read = Column(Boolean, default=False, index=True)
    metadata_json = Column(Text, nullable=True) # Extra info like medication_id, appointment_id, dose_time
    created_at = Column(DateTime, default=utc_now, index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    elder = relationship("ElderlyProfile", back_populates="notifications")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action_type = Column(Enum(ActionType), nullable=False, index=True)
    description = Column(Text, nullable=False)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    # Relationships
    elder = relationship("ElderlyProfile", back_populates="activity_logs")
    user = relationship("User", back_populates="activity_logs")

