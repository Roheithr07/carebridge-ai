from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import (
    Medication, MedicationSchedule, MedicationLog, ElderlyProfile,
    MedicationStatus, DoseStatus, ActionType, ActivityLog, User
)
from app.schemas import (
    MedicationCreate, MedicationUpdate, ScheduleItemCreate,
    DailyDoseItem, DoseActionRequest
)


def ensure_daily_logs_exist(db: Session, elder_id: int, target_date: date):
    """
    Ensures MedicationLog rows exist for all active medications and their schedules
    on the target date. Prevents duplicate logs using UniqueConstraint and checks.
    """
    # Fetch active medications for this elder
    medications = db.query(Medication).filter(
        Medication.elder_id == elder_id,
        Medication.status == MedicationStatus.ACTIVE
    ).all()

    day_of_week = str(target_date.isoweekday()) # 1=Mon, 7=Sun

    for med in medications:
        # Check start_date / end_date bounds
        if med.start_date and target_date < med.start_date:
            continue
        if med.end_date and target_date > med.end_date:
            continue

        for schedule in med.schedules:
            if not schedule.is_active:
                continue

            # Check days of week
            if schedule.days_of_week != "all":
                allowed_days = [d.strip() for d in schedule.days_of_week.split(",")]
                if day_of_week not in allowed_days:
                    continue

            # Check if log already exists
            existing = db.query(MedicationLog).filter(
                MedicationLog.medication_id == med.id,
                MedicationLog.schedule_id == schedule.id,
                MedicationLog.scheduled_date == target_date,
                MedicationLog.scheduled_time == schedule.time_of_day
            ).first()

            if not existing:
                new_log = MedicationLog(
                    medication_id=med.id,
                    schedule_id=schedule.id,
                    elder_id=elder_id,
                    scheduled_date=target_date,
                    scheduled_time=schedule.time_of_day,
                    status=DoseStatus.PENDING
                )
                db.add(new_log)

    db.commit()


def get_daily_schedule(db: Session, elder_id: int, target_date: date) -> List[DailyDoseItem]:
    """Retrieves all scheduled doses for a given date with status and details."""
    ensure_daily_logs_exist(db, elder_id, target_date)

    logs = db.query(MedicationLog).filter(
        MedicationLog.elder_id == elder_id,
        MedicationLog.scheduled_date == target_date
    ).order_by(MedicationLog.scheduled_time.asc()).all()

    items: List[DailyDoseItem] = []
    for l in logs:
        med = l.medication
        sched = l.schedule
        items.append(
            DailyDoseItem(
                log_id=l.id,
                medication_id=med.id,
                medication_name=med.name,
                dosage=med.dosage,
                instructions=med.instructions,
                schedule_id=sched.id if sched else None,
                scheduled_time=l.scheduled_time,
                time_label=sched.label if sched else None,
                scheduled_date=l.scheduled_date,
                status=l.status,
                action_time=l.action_time,
                notes=l.notes
            )
        )
    return items


def record_dose_action(
    db: Session, current_user: User, log_id: int, action: DoseActionRequest
) -> MedicationLog:
    """Updates a dose status to taken, skipped, or missed."""
    log = db.query(MedicationLog).filter(MedicationLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication dose record not found.")

    now = datetime.now(timezone.utc)
    old_status = log.status
    log.status = action.status
    log.action_time = now
    log.action_by_user_id = current_user.id
    if action.notes:
        log.notes = action.notes

    # Determine activity action type
    action_type = ActionType.DOSE_TAKEN if action.status == DoseStatus.TAKEN else (
        ActionType.DOSE_SKIPPED if action.status == DoseStatus.SKIPPED else ActionType.MISSED_DOSE_DETECTED
    )

    actor_desc = f"by {current_user.full_name}" if current_user.id != log.elder.user_id else "by elder"
    activity = ActivityLog(
        elder_id=log.elder_id,
        user_id=current_user.id,
        action_type=action_type,
        description=f"Dose of {log.medication.name} ({log.medication.dosage}) at {log.scheduled_time} marked as {action.status.value.upper()} {actor_desc}."
    )
    db.add(activity)

    db.commit()
    db.refresh(log)
    return log


def create_medication(
    db: Session, current_user: User, elder_id: int, med_in: MedicationCreate
) -> Medication:
    new_med = Medication(
        elder_id=elder_id,
        name=med_in.name.strip(),
        dosage=med_in.dosage.strip(),
        frequency=med_in.frequency.strip(),
        instructions=med_in.instructions,
        prescribing_doctor=med_in.prescribing_doctor,
        start_date=med_in.start_date or date.today(),
        end_date=med_in.end_date,
        status=MedicationStatus.ACTIVE
    )
    db.add(new_med)
    db.flush()

    # Add schedule items
    if med_in.schedules:
        for s in med_in.schedules:
            sched = MedicationSchedule(
                medication_id=new_med.id,
                elder_id=elder_id,
                time_of_day=s.time_of_day.strip(),
                label=s.label or "Dose",
                days_of_week=s.days_of_week or "all",
                dose_quantity=s.dose_quantity or "1 dose",
                is_active=True
            )
            db.add(sched)
    else:
        # Default single morning schedule if none provided
        default_sched = MedicationSchedule(
            medication_id=new_med.id,
            elder_id=elder_id,
            time_of_day="08:00",
            label="Morning",
            days_of_week="all",
            dose_quantity="1 dose",
            is_active=True
        )
        db.add(default_sched)

    # Activity log
    activity = ActivityLog(
        elder_id=elder_id,
        user_id=current_user.id,
        action_type=ActionType.MEDICATION_ADDED,
        description=f"Added medication {new_med.name} ({new_med.dosage}) prescribed by {new_med.prescribing_doctor or 'Doctor'}."
    )
    db.add(activity)

    db.commit()
    db.refresh(new_med)

    # Generate logs for today immediately
    ensure_daily_logs_exist(db, elder_id, date.today())
    return new_med


def update_medication(
    db: Session, current_user: User, med_id: int, med_in: MedicationUpdate
) -> Medication:
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found.")

    update_data = med_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(med, field, value)

    activity = ActivityLog(
        elder_id=med.elder_id,
        user_id=current_user.id,
        action_type=ActionType.MEDICATION_UPDATED,
        description=f"Updated medication details for {med.name}."
    )
    db.add(activity)

    db.commit()
    db.refresh(med)
    return med


def delete_medication(db: Session, current_user: User, med_id: int) -> bool:
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found.")

    elder_id = med.elder_id
    med_name = med.name

    db.delete(med)

    activity = ActivityLog(
        elder_id=elder_id,
        user_id=current_user.id,
        action_type=ActionType.MEDICATION_DELETED,
        description=f"Removed medication {med_name} from active schedule."
    )
    db.add(activity)

    db.commit()
    return True

