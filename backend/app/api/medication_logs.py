from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import MedicationLog, User, DoseStatus
from app.schemas import MedicationLogResponse, AdherenceStats
from app.api.deps import get_current_user, resolve_elder_profile
from app.services.adherence_service import calculate_adherence_stats

router = APIRouter(prefix="/medication-logs", tags=["Medication Logs & Adherence"])


@router.get("", response_model=List[MedicationLogResponse])
def get_medication_logs(
    elder_id: Optional[int] = None,
    status_filter: Optional[DoseStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    query = db.query(MedicationLog).filter(MedicationLog.elder_id == elder.id)

    if status_filter:
        query = query.filter(MedicationLog.status == status_filter)
    if start_date:
        query = query.filter(MedicationLog.scheduled_date >= start_date)
    if end_date:
        query = query.filter(MedicationLog.scheduled_date <= end_date)

    logs = query.order_by(MedicationLog.scheduled_date.desc(), MedicationLog.scheduled_time.desc()).limit(100).all()

    results = []
    for l in logs:
        results.append(
            MedicationLogResponse(
                id=l.id,
                medication_id=l.medication_id,
                schedule_id=l.schedule_id,
                elder_id=l.elder_id,
                scheduled_date=l.scheduled_date,
                scheduled_time=l.scheduled_time,
                status=l.status,
                action_time=l.action_time,
                action_by_user_id=l.action_by_user_id,
                notes=l.notes,
                medication_name=l.medication.name if l.medication else None,
                dosage=l.medication.dosage if l.medication else None,
                time_label=l.schedule.label if l.schedule else None
            )
        )
    return results


@router.get("/adherence", response_model=AdherenceStats)
def get_adherence(
    elder_id: Optional[int] = None,
    days_back: int = Query(14, ge=3, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    return calculate_adherence_stats(db, elder.id, days_back=days_back)

