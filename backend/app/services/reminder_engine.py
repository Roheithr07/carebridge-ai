import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import (
    MedicationLog, DoseStatus, Appointment, AppointmentStatus,
    Notification, NotificationType, ElderlyProfile, PatientAccess,
    AccessStatus, ActionType, ActivityLog
)
from app.core.config import settings
from app.services.email_service import (
    send_upcoming_medication_email,
    send_missed_dose_email,
    send_appointment_email
)

logger = logging.getLogger("carebridge.reminders")


def check_and_process_reminders(db: Session):
    """
    Automated Smart Reminder Engine:
    1. Overdue doses past the configured grace period (default 30 min) -> marks MISSED, alerts senior & active family/caregivers.
    2. Upcoming doses due within the next 30 minutes -> sends medication reminders.
    3. Upcoming doctor appointments:
       - 24 hours advance reminder
       - 2 hours advance reminder
       Strictly ignores cancelled/completed appointments.
    Strictly enforces per-recipient idempotency to eliminate duplicate notifications.
    """
    now_utc = datetime.now(timezone.utc)
    now_local = datetime.now() # Server local time
    today = now_local.date()
    current_time_str = now_local.strftime("%H:%M")

    grace_minutes = settings.GRACE_PERIOD_MINUTES or 30
    grace_cutoff_dt = now_local - timedelta(minutes=grace_minutes)
    grace_threshold_time = grace_cutoff_dt.strftime("%H:%M")
    upcoming_threshold_time = (now_local + timedelta(minutes=30)).strftime("%H:%M")

    missed_count = 0
    upcoming_count = 0
    appt_count = 0

    # ========================================================
    # 1. OVERDUE DOSES (Past Grace Period) -> MISSED DOSE ALERTS
    # ========================================================
    overdue_logs = db.query(MedicationLog).filter(
        MedicationLog.scheduled_date == today,
        MedicationLog.scheduled_time <= grace_threshold_time,
        MedicationLog.status == DoseStatus.PENDING
    ).all()

    for log in overdue_logs:
        elder = log.elder
        med = log.medication
        if not elder or not med:
            continue

        # Mark dose as MISSED in database
        log.status = DoseStatus.MISSED

        # A. Notify Elderly Patient
        elder_marker = f"missed_dose_{log.id}_{elder.user_id}"
        existing_elder_notif = db.query(Notification).filter(
            Notification.user_id == elder.user_id,
            Notification.metadata_json == elder_marker
        ).first()

        if not existing_elder_notif:
            elder_notif = Notification(
                user_id=elder.user_id,
                elder_id=elder.id,
                title="Missed Medication Alert",
                description=f"Your scheduled dose of {med.name} ({med.dosage}) at {log.scheduled_time} was marked as missed after the {grace_minutes}-minute grace window.",
                notification_type=NotificationType.MISSED_DOSE,
                metadata_json=elder_marker
            )
            db.add(elder_notif)

            # Record audit activity
            activity = ActivityLog(
                elder_id=elder.id,
                user_id=elder.user_id,
                action_type=ActionType.MISSED_DOSE_DETECTED,
                description=f"Automated Alert: Missed dose of {med.name} ({med.dosage}) scheduled for {log.scheduled_time}."
            )
            db.add(activity)

        # B. Notify Authorized Family Members & Caregivers (Active only)
        active_accesses = db.query(PatientAccess).filter(
            PatientAccess.elder_id == elder.id,
            PatientAccess.status == AccessStatus.ACTIVE
        ).all()

        for acc in active_accesses:
            member_user = acc.authorized_user
            if not member_user:
                continue

            member_marker = f"missed_dose_{log.id}_{member_user.id}"
            existing_member_notif = db.query(Notification).filter(
                Notification.user_id == member_user.id,
                Notification.metadata_json == member_marker
            ).first()

            if not existing_member_notif:
                m_notif = Notification(
                    user_id=member_user.id,
                    elder_id=elder.id,
                    title=f"Alert: {elder.user.full_name} Missed Dose",
                    description=f"{elder.user.full_name} did not confirm taking {med.name} ({med.dosage}) scheduled for {log.scheduled_time} today.",
                    notification_type=NotificationType.MISSED_DOSE,
                    metadata_json=member_marker
                )
                db.add(m_notif)

                # Send email alert to family member / caregiver
                send_missed_dose_email(
                    to_email=member_user.email,
                    recipient_name=member_user.full_name,
                    elder_name=elder.user.full_name,
                    med_name=med.name,
                    dosage=med.dosage,
                    scheduled_time=log.scheduled_time
                )

    # ========================================================
    # 2. UPCOMING DOSES (Due in Next 30 Minutes)
    # ========================================================
    upcoming_logs = db.query(MedicationLog).filter(
        MedicationLog.scheduled_date == today,
        MedicationLog.scheduled_time >= current_time_str,
        MedicationLog.scheduled_time <= upcoming_threshold_time,
        MedicationLog.status == DoseStatus.PENDING
    ).all()

    for log in upcoming_logs:
        elder = log.elder
        med = log.medication
        if not elder or not med:
            continue

        up_marker = f"upcoming_dose_{log.id}_{elder.user_id}"
        existing_up_notif = db.query(Notification).filter(
            Notification.user_id == elder.user_id,
            Notification.metadata_json == up_marker
        ).first()

        if not existing_up_notif:
            notif = Notification(
                user_id=elder.user_id,
                elder_id=elder.id,
                title="Upcoming Medication Reminder",
                description=f"Your dose of {med.name} ({med.dosage}) is scheduled for {log.scheduled_time}. {med.instructions or ''}",
                notification_type=NotificationType.MEDICATION_REMINDER,
                metadata_json=up_marker
            )
            db.add(notif)

            send_upcoming_medication_email(
                to_email=elder.user.email,
                elder_name=elder.user.full_name,
                med_name=med.name,
                dosage=med.dosage,
                scheduled_time=log.scheduled_time,
                instructions=med.instructions
            )

    # ========================================================
    # 3. DOCTOR APPOINTMENT REMINDERS (24 Hours & 2 Hours Advance)
    # ========================================================
    # Query active SCHEDULED appointments within next 48 hours
    upcoming_appts = db.query(Appointment).filter(
        Appointment.appointment_date >= today,
        Appointment.appointment_date <= today + timedelta(days=2),
        Appointment.status == AppointmentStatus.SCHEDULED
    ).all()

    for appt in upcoming_appts:
        elder = appt.elder
        if not elder:
            continue

        # Parse appointment datetime
        try:
            appt_time_parts = [int(p) for p in appt.appointment_time.split(":")[:2]]
            appt_dt = datetime.combine(appt.appointment_date, datetime.min.time()).replace(
                hour=appt_time_parts[0], minute=appt_time_parts[1]
            )
        except Exception:
            continue

        diff_seconds = (appt_dt - now_local).total_seconds()
        diff_hours = diff_seconds / 3600.0

        # Only process upcoming future appointments
        if diff_seconds <= 0:
            continue

        active_accesses = db.query(PatientAccess).filter(
            PatientAccess.elder_id == elder.id,
            PatientAccess.status == AccessStatus.ACTIVE
        ).all()

        recipients = [(elder.user, "Patient")]
        for acc in active_accesses:
            if acc.authorized_user:
                recipients.append((acc.authorized_user, acc.relationship_label))

        # A. 24-Hour Advance Reminder (Trigger if between 2h and 24h away)
        if diff_hours <= 24.0:
            for user, relation in recipients:
                marker_24h = f"appt_24h_{appt.id}_{user.id}"
                has_24h = db.query(Notification).filter(
                    Notification.user_id == user.id,
                    Notification.metadata_json == marker_24h
                ).first()

                if not has_24h:
                    desc = (
                        f"Reminder: You have an appointment tomorrow with Dr. {appt.doctor_name} ({appt.specialty}) at {appt.appointment_time} at {appt.clinic_hospital}."
                        if user.id == elder.user_id else
                        f"Reminder: {elder.user.full_name} has an appointment tomorrow with Dr. {appt.doctor_name} at {appt.appointment_time} ({appt.clinic_hospital})."
                    )
                    notif = Notification(
                        user_id=user.id,
                        elder_id=elder.id,
                        title=f"Appointment Tomorrow: Dr. {appt.doctor_name}",
                        description=desc,
                        notification_type=NotificationType.APPOINTMENT_REMINDER,
                        metadata_json=marker_24h
                    )
                    db.add(notif)

                    send_appointment_email(
                        to_email=user.email,
                        recipient_name=user.full_name,
                        elder_name=elder.user.full_name,
                        doctor_name=appt.doctor_name,
                        specialty=appt.specialty or "General Checkup",
                        appt_date=appt.appointment_date.strftime("%A, %b %d, %Y"),
                        appt_time=appt.appointment_time,
                        hospital=appt.clinic_hospital,
                        address=appt.hospital_address
                    )

        # B. 2-Hour Advance Reminder (Trigger if within 2 hours)
        if diff_hours <= 2.0:
            for user, relation in recipients:
                marker_2h = f"appt_2h_{appt.id}_{user.id}"
                has_2h = db.query(Notification).filter(
                    Notification.user_id == user.id,
                    Notification.metadata_json == marker_2h
                ).first()

                if not has_2h:
                    desc = (
                        f"Upcoming Visit: Your appointment with Dr. {appt.doctor_name} is in less than 2 hours ({appt.appointment_time}) at {appt.clinic_hospital}."
                        if user.id == elder.user_id else
                        f"Upcoming Visit: {elder.user.full_name}'s appointment with Dr. {appt.doctor_name} is in less than 2 hours ({appt.appointment_time})."
                    )
                    notif = Notification(
                        user_id=user.id,
                        elder_id=elder.id,
                        title=f"Appointment in 2 Hours: Dr. {appt.doctor_name}",
                        description=desc,
                        notification_type=NotificationType.APPOINTMENT_REMINDER,
                        metadata_json=marker_2h
                    )
                    db.add(notif)
                    appt_count += 1

    db.commit()

    return {
        "overdue_doses_processed": len(overdue_logs),
        "missed_dose_alerts": missed_count,
        "upcoming_med_reminders": upcoming_count,
        "appointment_reminders": appt_count
    }
