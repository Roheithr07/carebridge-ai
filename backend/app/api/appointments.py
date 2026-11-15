from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Appointment, User, AppointmentStatus, ActionType, ActivityLog
from app.schemas import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.api.deps import get_current_user, resolve_elder_profile

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("", response_model=List[AppointmentResponse])
def get_appointments(
    elder_id: Optional[int] = None,
    upcoming_only: bool = False,
    target_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    query = db.query(Appointment).filter(Appointment.elder_id == elder.id)
    if upcoming_only:
        query = query.filter(Appointment.appointment_date >= date.today())
    if target_date:
        query = query.filter(Appointment.appointment_date == target_date)
    appts = query.order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).all()
    return appts


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    appt_in: AppointmentCreate,
    elder_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    appt = Appointment(
        elder_id=elder.id,
        created_by_user_id=current_user.id,
        doctor_name=appt_in.doctor_name.strip(),
        clinic_hospital=appt_in.clinic_hospital.strip(),
        specialty=appt_in.specialty or "General Checkup",
        appointment_date=appt_in.appointment_date,
        appointment_time=appt_in.appointment_time.strip(),
        hospital_address=appt_in.hospital_address.strip() if appt_in.hospital_address else None,
        room_department=appt_in.room_department.strip() if appt_in.room_department else None,
        appointment_type=appt_in.appointment_type or "Routine",
        notes=appt_in.notes,
        status=appt_in.status or AppointmentStatus.SCHEDULED,
        reminder_sent=False
    )
    db.add(appt)

    # Activity log
    activity = ActivityLog(
        elder_id=elder.id,
        user_id=current_user.id,
        action_type=ActionType.APPOINTMENT_CREATED,
        description=f"Scheduled appointment with Dr. {appt.doctor_name} ({appt.specialty}) on {appt.appointment_date.strftime('%b %d, %Y')} at {appt.appointment_time}."
    )
    db.add(activity)

    db.commit()
    db.refresh(appt)
    return appt


@router.put("/{appt_id}", response_model=AppointmentResponse)
def update_appointment(
    appt_id: int,
    appt_in: AppointmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    resolve_elder_profile(appt.elder_id, current_user, db)

    data = appt_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(appt, k, v)

    activity = ActivityLog(
        elder_id=appt.elder_id,
        user_id=current_user.id,
        action_type=ActionType.APPOINTMENT_UPDATED,
        description=f"Updated appointment details for Dr. {appt.doctor_name} ({appt.status.value})."
    )
    db.add(activity)

    db.commit()
    db.refresh(appt)
    return appt


@router.delete("/{appt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    resolve_elder_profile(appt.elder_id, current_user, db)

    elder_id = appt.elder_id
    doctor_name = appt.doctor_name

    db.delete(appt)

    activity = ActivityLog(
        elder_id=elder_id,
        user_id=current_user.id,
        action_type=ActionType.APPOINTMENT_CANCELLED,
        description=f"Cancelled and removed appointment with Dr. {doctor_name}."
    )
    db.add(activity)

    db.commit()
    return None

