from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User
from app.schemas import AISummaryResponse
from app.api.deps import get_current_user, resolve_elder_profile
from app.services.ai_summary_service import generate_ai_healthcare_summary

router = APIRouter(prefix="/ai-summary", tags=["AI Healthcare Summary"])


@router.get("", response_model=AISummaryResponse)
async def get_ai_summary(
    elder_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    return await generate_ai_healthcare_summary(db, elder.id)
