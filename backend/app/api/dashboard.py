from datetime import date, datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import (
    User, UserRole, ElderlyProfile, Medication, MedicationLog, DoseStatus,
    Appointment, AppointmentStatus, PatientAccess, AccessStatus, Notification, ActivityLog
)
from app.api.deps import get_current_user, require_roles
from app.services.medication_service import get_daily_schedule, ensure_daily_logs_exist
from app.services.adherence_service import calculate_adherence_stats
from app.services.access_service import list_connected_patients_for_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/elder")
def get_elder_dashboard(
    current_user: User = Depends(require_roles([UserRole.ELDERLY])),
    db: Session = Depends(get_db)
):
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Elderly profile not found.")

    today = date.today()
    ensure_daily_logs_exist(db, profile.id, today)
    daily_doses = get_daily_schedule(db, profile.id, today)

    total_today = len(daily_doses)
    taken_today = sum(1 for d in daily_doses if d.status == DoseStatus.TAKEN)
    skipped_today = sum(1 for d in daily_doses if d.status == DoseStatus.SKIPPED)
    missed_today = sum(1 for d in daily_doses if d.status == DoseStatus.MISSED)
    pending_today = sum(1 for d in daily_doses if d.status == DoseStatus.PENDING)

    # 14-day adherence
    adherence_stats = calculate_adherence_stats(db, profile.id, days_back=14)

    # Upcoming appointments (next 3)
    upcoming_appointments = db.query(Appointment).filter(
        Appointment.elder_id == profile.id,
        Appointment.appointment_date >= today,
        Appointment.status == AppointmentStatus.SCHEDULED
    ).order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).limit(3).all()

    # Recent activities (last 5)
    recent_activities = db.query(ActivityLog).filter(
        ActivityLog.elder_id == profile.id
    ).order_by(ActivityLog.created_at.desc()).limit(6).all()

    # Connected family and caregivers count
    connected_members_count = db.query(PatientAccess).filter(
        PatientAccess.elder_id == profile.id,
        PatientAccess.status == AccessStatus.ACTIVE
    ).count()

    # Unread notifications count
    unread_notifications_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {
        "profile": {
            "id": profile.id,
            "full_name": current_user.full_name,
            "share_code": profile.share_code,
            "emergency_contact_name": profile.emergency_contact_name,
            "emergency_contact_phone": profile.emergency_contact_phone,
            "allergies": profile.allergies,
            "medical_conditions": profile.medical_conditions
        },
        "today_stats": {
            "total_doses": total_today,
            "taken_doses": taken_today,
            "skipped_doses": skipped_today,
            "missed_doses": missed_today,
            "pending_doses": pending_today,
            "today_adherence": round((taken_today / total_today * 100), 1) if total_today > 0 else 100.0
        },
        "daily_doses": daily_doses,
        "adherence": adherence_stats,
        "upcoming_appointments": upcoming_appointments,
        "recent_activities": recent_activities,
        "connected_members_count": connected_members_count,
        "unread_notifications_count": unread_notifications_count
    }


@router.get("/family")
def get_family_dashboard(
    current_user: User = Depends(require_roles([UserRole.FAMILY])),
    db: Session = Depends(get_db)
):
    connected_patients = list_connected_patients_for_user(db, current_user)

    # Gather missed dose alerts across connected patients
    elder_ids = [p.elder_id for p in connected_patients]
    today = date.today()

    missed_doses = []
    upcoming_appointments = []
    recent_activities = []

    if elder_ids:
        # Missed doses today or past 3 days
        missed_logs = db.query(MedicationLog).filter(
            MedicationLog.elder_id.in_(elder_ids),
            MedicationLog.status == DoseStatus.MISSED,
            MedicationLog.scheduled_date >= (today - date.resolution * 3)
        ).order_by(MedicationLog.scheduled_date.desc(), MedicationLog.scheduled_time.desc()).limit(10).all()

        for ml in missed_logs:
            missed_doses.append({
                "log_id": ml.id,
                "elder_id": ml.elder_id,
                "elder_name": ml.elder.user.full_name,
                "medication_name": ml.medication.name,
                "dosage": ml.medication.dosage,
                "scheduled_date": ml.scheduled_date,
                "scheduled_time": ml.scheduled_time
            })

        # Upcoming appointments
        upcoming_appointments = db.query(Appointment).filter(
            Appointment.elder_id.in_(elder_ids),
            Appointment.appointment_date >= today,
            Appointment.status == AppointmentStatus.SCHEDULED
        ).order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).limit(5).all()

        # Recent activities
        recent_activities = db.query(ActivityLog).filter(
            ActivityLog.elder_id.in_(elder_ids)
        ).order_by(ActivityLog.created_at.desc()).limit(8).all()

    unread_notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {
        "user_name": current_user.full_name,
        "connected_patients": connected_patients,
        "missed_dose_alerts": missed_doses,
        "upcoming_appointments": upcoming_appointments,
        "recent_activities": recent_activities,
        "unread_notifications_count": unread_notifications
    }


@router.get("/caregiver")
def get_caregiver_dashboard(
    current_user: User = Depends(require_roles([UserRole.CAREGIVER])),
    db: Session = Depends(get_db)
):
    assigned_patients = list_connected_patients_for_user(db, current_user)
    elder_ids = [p.elder_id for p in assigned_patients]
    today = date.today()

    all_today_doses = []
    pending_doses = []
    missed_doses = []
    upcoming_appointments = []
    recent_activities = []

    if elder_ids:
        # Fetch today's schedule across all assigned patients
        for p in assigned_patients:
            ensure_daily_logs_exist(db, p.elder_id, today)
            doses = get_daily_schedule(db, p.elder_id, today)
            for d in doses:
                dose_item = d.model_dump()
                dose_item["elder_id"] = p.elder_id
                dose_item["elder_name"] = p.elder_name
                all_today_doses.append(dose_item)
                if d.status == DoseStatus.PENDING:
                    pending_doses.append(dose_item)
                elif d.status == DoseStatus.MISSED:
                    missed_doses.append(dose_item)

        upcoming_appointments = db.query(Appointment).filter(
            Appointment.elder_id.in_(elder_ids),
            Appointment.appointment_date >= today,
            Appointment.status == AppointmentStatus.SCHEDULED
        ).order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).limit(6).all()

        recent_activities = db.query(ActivityLog).filter(
            ActivityLog.elder_id.in_(elder_ids)
        ).order_by(ActivityLog.created_at.desc()).limit(10).all()

    unread_notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {
        "caregiver_name": current_user.full_name,
        "assigned_patients": assigned_patients,
        "today_schedule": all_today_doses,
        "pending_doses": pending_doses,
        "missed_doses": missed_doses,
        "upcoming_appointments": upcoming_appointments,
        "recent_activities": recent_activities,
        "unread_notifications_count": unread_notifications
    }

