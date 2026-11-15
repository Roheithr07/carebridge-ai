from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import (
    User, ElderlyProfile, PatientAccess, UserRole, 
    AccessStatus, ActionType, ActivityLog, Notification, NotificationType
)
from app.schemas import ConnectAccessRequest, PatientAccessResponse, ConnectedPatientResponse
from app.services.email_service import send_family_connection_email, send_caregiver_connection_email


def get_elder_profile_by_user_id(db: Session, user_id: int) -> ElderlyProfile:
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Elderly healthcare profile not found for this user."
        )
    return profile


def get_elder_profile_by_id(db: Session, elder_id: int) -> ElderlyProfile:
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.id == elder_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Elderly healthcare profile not found."
        )
    return profile


def verify_user_access_to_elder(
    db: Session, current_user: User, elder_id: int, required_permission: str = "view"
) -> ElderlyProfile:
    """
    Validates that current_user has authorized access to elder_id.
    Elderly user has full access to their own profile.
    Family/Caregiver must have an ACTIVE PatientAccess record.
    """
    profile = get_elder_profile_by_id(db, elder_id)

    # Elderly user accessing their own profile
    if current_user.role == UserRole.ELDERLY and profile.user_id == current_user.id:
        return profile

    # Family or Caregiver access check
    access = db.query(PatientAccess).filter(
        PatientAccess.elder_id == elder_id,
        PatientAccess.user_id == current_user.id,
        PatientAccess.status == AccessStatus.ACTIVE
    ).first()

    if not access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view or manage this patient's healthcare profile."
        )

    if required_permission == "manage" and access.permissions == "view_only":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your access is restricted to read-only permissions."
        )

    return profile


def connect_with_share_code(
    db: Session, current_user: User, req: ConnectAccessRequest
) -> PatientAccess:
    if current_user.role == UserRole.ELDERLY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Elderly accounts cannot connect to other elderly profiles as caregivers."
        )

    code = req.share_code.strip().upper()
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.share_code == code).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid patient passcode. Please check the code with the elderly individual."
        )

    # Check if existing access record
    existing = db.query(PatientAccess).filter(
        PatientAccess.elder_id == profile.id,
        PatientAccess.user_id == current_user.id
    ).first()

    now = datetime.now(timezone.utc)
    if existing:
        if existing.status == AccessStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You are already actively connected to {profile.user.full_name}'s profile."
            )
        # Reactivate
        existing.status = AccessStatus.ACTIVE
        existing.relationship_label = req.relationship_label.strip()
        existing.role = current_user.role
        existing.access_code_used = code
        existing.granted_at = now
        existing.revoked_at = None
        access = existing
    else:
        access = PatientAccess(
            elder_id=profile.id,
            user_id=current_user.id,
            relationship_label=req.relationship_label.strip(),
            role=current_user.role,
            status=AccessStatus.ACTIVE,
            permissions="view_and_manage",
            access_code_used=code,
            granted_at=now
        )
        db.add(access)

    # Log activity
    log = ActivityLog(
        elder_id=profile.id,
        user_id=current_user.id,
        action_type=ActionType.ACCESS_GRANTED,
        description=f"{current_user.full_name} ({req.relationship_label}) connected using secure passcode."
    )
    db.add(log)

    # In-app notification to the elder
    notif = Notification(
        user_id=profile.user_id,
        elder_id=profile.id,
        title="New Healthcare Connection",
        description=f"{current_user.full_name} connected to your profile as {req.relationship_label}.",
        notification_type=NotificationType.ACCESS_ALERT
    )
    db.add(notif)

    # Send confirmation email to connecting member
    if current_user.role == UserRole.FAMILY:
        send_family_connection_email(
            to_email=current_user.email,
            member_name=current_user.full_name,
            elder_name=profile.user.full_name,
            relationship=req.relationship_label
        )
    elif current_user.role == UserRole.CAREGIVER:
        send_caregiver_connection_email(
            to_email=current_user.email,
            caregiver_name=current_user.full_name,
            elder_name=profile.user.full_name
        )

    db.commit()
    db.refresh(access)
    return access


def revoke_patient_access(
    db: Session, current_user: User, access_id: int
) -> PatientAccess:
    """Allows an elderly individual to revoke family or caregiver access immediately."""
    access = db.query(PatientAccess).filter(PatientAccess.id == access_id).first()
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access record not found."
        )

    # Check ownership: only the elder whose profile it is can revoke (or an admin)
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.id == access.elder_id).first()
    if not profile or (current_user.role == UserRole.ELDERLY and profile.user_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage access authorizations for your own profile."
        )

    now = datetime.now(timezone.utc)
    access.status = AccessStatus.REVOKED
    access.revoked_at = now

    # Log revocation
    log = ActivityLog(
        elder_id=profile.id,
        user_id=current_user.id,
        action_type=ActionType.ACCESS_REVOKED,
        description=f"Access for {access.authorized_user.full_name} ({access.relationship_label}) was revoked."
    )
    db.add(log)

    # Notify revoked user
    notif = Notification(
        user_id=access.user_id,
        elder_id=profile.id,
        title="Healthcare Profile Access Revoked",
        description=f"Your access to {profile.user.full_name}'s healthcare profile has been revoked.",
        notification_type=NotificationType.ACCESS_ALERT
    )
    db.add(notif)

    db.commit()
    db.refresh(access)
    return access


def list_connected_members(db: Session, elder_id: int) -> List[PatientAccessResponse]:
    records = db.query(PatientAccess).filter(
        PatientAccess.elder_id == elder_id
    ).all()

    result = []
    for r in records:
        result.append(
            PatientAccessResponse(
                id=r.id,
                elder_id=r.elder_id,
                user_id=r.user_id,
                user_name=r.authorized_user.full_name if r.authorized_user else "Unknown",
                user_email=r.authorized_user.email if r.authorized_user else "",
                user_phone=r.authorized_user.phone_number if r.authorized_user else None,
                relationship_label=r.relationship_label,
                role=r.role,
                status=r.status,
                permissions=r.permissions,
                granted_at=r.granted_at,
                revoked_at=r.revoked_at
            )
        )
    return result


def list_connected_patients_for_user(db: Session, user: User) -> List[ConnectedPatientResponse]:
    """Returns all active elderly patients connected to this family member or caregiver."""
    accesses = db.query(PatientAccess).filter(
        PatientAccess.user_id == user.id,
        PatientAccess.status == AccessStatus.ACTIVE
    ).all()

    result = []
    today = datetime.now(timezone.utc).date()

    for acc in accesses:
        elder = acc.elder
        if not elder or not elder.user:
            continue

        # Get quick today stats
        from app.models import MedicationLog, DoseStatus, Appointment, AppointmentStatus
        logs_today = db.query(MedicationLog).filter(
            MedicationLog.elder_id == elder.id,
            MedicationLog.scheduled_date == today
        ).all()

        total = len(logs_today)
        taken = sum(1 for l in logs_today if l.status == DoseStatus.TAKEN)
        missed = sum(1 for l in logs_today if l.status == DoseStatus.MISSED)
        pending = sum(1 for l in logs_today if l.status == DoseStatus.PENDING)

        adherence = round((taken / total * 100), 1) if total > 0 else 100.0

        next_appt = db.query(Appointment).filter(
            Appointment.elder_id == elder.id,
            Appointment.appointment_date >= today,
            Appointment.status == AppointmentStatus.SCHEDULED
        ).order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).first()

        result.append(
            ConnectedPatientResponse(
                elder_id=elder.id,
                elder_user_id=elder.user_id,
                elder_name=elder.user.full_name,
                elder_phone=elder.user.phone_number,
                relationship_label=acc.relationship_label,
                blood_group=elder.blood_group,
                medical_conditions=elder.medical_conditions,
                allergies=elder.allergies,
                emergency_contact=elder.emergency_contact_name,
                emergency_phone=elder.emergency_contact_phone,
                today_adherence=adherence,
                pending_doses_today=pending,
                missed_doses_today=missed,
                next_appointment=next_appt
            )
        )

    return result

