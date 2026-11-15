from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import ActivityLog, User
from app.schemas import ActivityLogResponse
from app.api.deps import get_current_user, resolve_elder_profile

router = APIRouter(prefix="/activity", tags=["Activity Timeline"])


@router.get("", response_model=List[ActivityLogResponse])
def get_activity_timeline(
    elder_id: Optional[int] = None,
    limit: int = Query(50, ge=5, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    elder = resolve_elder_profile(elder_id, current_user, db)
    logs = db.query(ActivityLog).filter(
        ActivityLog.elder_id == elder.id
    ).order_by(ActivityLog.created_at.desc()).limit(limit).all()

    result = []
    for l in logs:
        result.append(
            ActivityLogResponse(
                id=l.id,
                elder_id=l.elder_id,
                user_id=l.user_id,
                user_name=l.user.full_name if l.user else "System",
                action_type=l.action_type,
                description=l.description,
                details_json=l.details_json,
                created_at=l.created_at
            )
        )
    return result

