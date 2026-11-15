import random
import string
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import User, ElderlyProfile, UserRole, ActionType, ActivityLog
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas import UserRegister, UserLogin


def generate_share_code() -> str:
    """Generates a clean 6-digit alphanumeric passcode for elderly profile sharing e.g. 'CB-8492'"""
    num = ''.join(random.choices(string.digits, k=6))
    return f"CB-{num}"


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower().strip()).first()


def register_user(db: Session, user_in: UserRegister) -> User:
    existing = get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hashed_pw,
        full_name=user_in.full_name.strip(),
        phone_number=user_in.phone_number,
        role=user_in.role
    )
    db.add(new_user)
    db.flush()

    # If the user is an ELDERLY individual, automatically generate their healthcare profile and unique passcode
    if user_in.role == UserRole.ELDERLY:
        share_code = generate_share_code()
        # Ensure uniqueness
        while db.query(ElderlyProfile).filter(ElderlyProfile.share_code == share_code).first():
            share_code = generate_share_code()

        profile = ElderlyProfile(
            user_id=new_user.id,
            share_code=share_code,
            date_of_birth=user_in.date_of_birth,
            blood_group=user_in.blood_group,
            emergency_contact_name=user_in.emergency_contact_name,
            emergency_contact_phone=user_in.emergency_contact_phone,
            allergies=user_in.allergies,
            medical_conditions=user_in.medical_conditions
        )
        db.add(profile)
        db.flush()

        # Log creation
        log = ActivityLog(
            elder_id=profile.id,
            user_id=new_user.id,
            action_type=ActionType.ACCESS_GRANTED,
            description="Elderly healthcare profile initialized with secure sharing passcode."
        )
        db.add(log)

    db.commit()
    db.refresh(new_user)
    return new_user


def authenticate_user(db: Session, login_data: UserLogin) -> User:
    user = get_user_by_email(db, login_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently disabled."
        )
    return user

