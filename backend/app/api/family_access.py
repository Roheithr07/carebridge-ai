import random, string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User, UserRole, ElderlyProfile, PatientAccess, AccessStatus, ActionType, ActivityLog
from app.schemas import ConnectAccessRequest, PatientAccessResponse, ConnectedPatientResponse
from app.api.deps import get_current_user, require_roles
from app.services.access_service import (
    connect_with_share_code, revoke_patient_access,
    list_connected_members, list_connected_patients_for_user
)
from app.services.auth_service import generate_share_code

router = APIRouter(prefix="/family", tags=["Family & Caregiver Access"])


@router.post("/connect", response_model=dict)
def connect_patient(
    req: ConnectAccessRequest,
    current_user: User = Depends(require_roles([UserRole.FAMILY, UserRole.CAREGIVER])),
    db: Session = Depends(get_db)
):
    access = connect_with_share_code(db, current_user, req)
    return {
        "message": f"Successfully linked to {access.elder.user.full_name}'s profile.",
        "access_id": access.id,
        "elder_id": access.elder_id,
        "elder_name": access.elder.user.full_name,
        "relationship": access.relationship_label,
        "status": access.status.value
    }


@router.get("/members", response_model=List[PatientAccessResponse])
def get_connected_members(
    current_user: User = Depends(require_roles([UserRole.ELDERLY])),
    db: Session = Depends(get_db)
):
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return list_connected_members(db, profile.id)


@router.delete("/members/{access_id}")
@router.delete("/revoke/{access_id}")
def revoke_access(
    access_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    revoked = revoke_patient_access(db, current_user, access_id)
    return {
        "message": f"Access for {revoked.authorized_user.full_name} has been revoked.",
        "status": "revoked"
    }


@router.get("/patients", response_model=List[ConnectedPatientResponse])
def get_connected_patients(
    current_user: User = Depends(require_roles([UserRole.FAMILY, UserRole.CAREGIVER])),
    db: Session = Depends(get_db)
):
    return list_connected_patients_for_user(db, current_user)


@router.post("/regenerate-code")
def regenerate_share_code(
    current_user: User = Depends(require_roles([UserRole.ELDERLY])),
    db: Session = Depends(get_db)
):
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    new_code = generate_share_code()
    while db.query(ElderlyProfile).filter(ElderlyProfile.share_code == new_code).first():
        new_code = generate_share_code()

    old_code = profile.share_code
    profile.share_code = new_code

    activity = ActivityLog(
        elder_id=profile.id,
        user_id=current_user.id,
        action_type=ActionType.ACCESS_GRANTED,
        description=f"Generated new patient sharing passcode ({new_code}). Previous passcode was rotated."
    )
    db.add(activity)

    db.commit()
    db.refresh(profile)
    return {
        "new_share_code": new_code,
        "message": "Share code successfully updated."
    }

