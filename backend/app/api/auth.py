from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token
from app.models import User, ElderlyProfile, UserRole
from app.schemas import UserRegister, UserLogin, Token, UserResponse, ElderlyProfileUpdate, ElderlyProfileResponse
from app.services.auth_service import register_user, authenticate_user
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    user = register_user(db, user_in)
    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data)
    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/elder-profile", response_model=ElderlyProfileResponse)
def update_elder_profile(
    profile_in: ElderlyProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.ELDERLY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only elderly users can update their healthcare profile directly."
        )

    profile = db.query(ElderlyProfile).filter(ElderlyProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    data = profile_in.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(profile, field, val)

    db.commit()
    db.refresh(profile)
    return ElderlyProfileResponse.model_validate(profile)

