from typing import Generator, Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User, UserRole, ElderlyProfile, PatientAccess, AccessStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account.")
    return user


def require_roles(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker


def resolve_elder_profile(
    elder_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ElderlyProfile:
    """
    Helper dependency to resolve target ElderlyProfile.
    If current_user is ELDERLY and elder_id is not specified, returns their own profile.
    If current_user is FAMILY or CAREGIVER, elder_id is required and authorization is checked.
    """
    if current_user.role == UserRole.ELDERLY:
        if elder_id is not None:
            profile = db.query(ElderlyProfile).filter(ElderlyProfile.id == elder_id).first()
            if not profile or profile.user_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
            return profile
        profile = db.query(ElderlyProfile).filter(ElderlyProfile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Elderly profile not initialized.")
        return profile

    # Family or Caregiver
    if not elder_id:
        # Check if connected to exactly one elder; if so, default to that elder
        accesses = db.query(PatientAccess).filter(
            PatientAccess.user_id == current_user.id,
            PatientAccess.status == AccessStatus.ACTIVE
        ).all()
        if len(accesses) == 1:
            return accesses[0].elder
        elif len(accesses) > 1:
            # Pick first or ask for explicit elder_id
            return accesses[0].elder
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="elder_id query parameter is required for family or caregiver requests."
        )

    profile = db.query(ElderlyProfile).filter(ElderlyProfile.id == elder_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Elderly profile not found.")

    access = db.query(PatientAccess).filter(
        PatientAccess.elder_id == elder_id,
        PatientAccess.user_id == current_user.id,
        PatientAccess.status == AccessStatus.ACTIVE
    ).first()
    if not access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this patient's healthcare profile."
        )
    return profile

