from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Medication, User, UserRole, ElderlyProfile
from app.schemas import (
    MedicationCreate, MedicationUpdate, MedicationResponse,
    DailyDoseItem, DoseActionRequest, MedicationLogResponse
)
from app.api.deps import get_current_user, resolve_elder_profile
from app.services.medication_service import (
    create_medication, update_medication, delete_medication,
    get_daily_schedule, record_dose_action
)

router = APIRouter(prefix="/medications", tags=["Medications"])


@router.get("", response_model=List[MedicationResponse])
def get_medications(
    elder_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    meds = db.query(Medication).filter(Medication.elder_id == elder.id).all()
    return meds


@router.post("", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def add_medication(
    med_in: MedicationCreate,
    elder_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    return create_medication(db, current_user, elder.id, med_in)


@router.put("/{med_id}", response_model=MedicationResponse)
def modify_medication(
    med_id: int,
    med_in: MedicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found.")
    # Check access
    resolve_elder_profile(med.elder_id, current_user, db)
    return update_medication(db, current_user, med_id, med_in)


@router.delete("/{med_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_medication(
    med_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found.")
    resolve_elder_profile(med.elder_id, current_user, db)
    delete_medication(db, current_user, med_id)
    return None


@router.get("/daily-schedule", response_model=List[DailyDoseItem])
def get_daily_doses(
    elder_id: Optional[int] = None,
    target_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    eval_date = target_date or date.today()
    return get_daily_schedule(db, elder.id, eval_date)


@router.post("/logs/{log_id}/action", response_model=MedicationLogResponse)
def log_dose_action(
    log_id: int,
    action: DoseActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import MedicationLog
    log = db.query(MedicationLog).filter(MedicationLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found.")
    resolve_elder_profile(log.elder_id, current_user, db)
    updated_log = record_dose_action(db, current_user, log_id, action)
    return MedicationLogResponse(
        id=updated_log.id,
        medication_id=updated_log.medication_id,
        schedule_id=updated_log.schedule_id,
        elder_id=updated_log.elder_id,
        scheduled_date=updated_log.scheduled_date,
        scheduled_time=updated_log.scheduled_time,
        status=updated_log.status,
        action_time=updated_log.action_time,
        action_by_user_id=updated_log.action_by_user_id,
        notes=updated_log.notes,
        medication_name=updated_log.medication.name if updated_log.medication else None,
        dosage=updated_log.medication.dosage if updated_log.medication else None,
        time_label=updated_log.schedule.label if updated_log.schedule else None
    )

