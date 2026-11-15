from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Notification, NotificationType, User
from app.schemas import NotificationResponse
from app.api.deps import get_current_user
from app.services.reminder_engine import check_and_process_reminders

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    unread_only: bool = False,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    if category:
        cat_lower = category.lower()
        if cat_lower == "medication":
            query = query.filter(Notification.notification_type.in_([
                NotificationType.MEDICATION_REMINDER,
                NotificationType.MISSED_DOSE
            ]))
        elif cat_lower == "appointment":
            query = query.filter(Notification.notification_type == NotificationType.APPOINTMENT_REMINDER)
        elif cat_lower == "security" or cat_lower == "family":
            query = query.filter(Notification.notification_type.in_([
                NotificationType.ACCESS_ALERT,
                NotificationType.CARE_UPDATE
            ]))

    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    return notifications


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    return {"unread_count": count}


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read.", "id": notification_id}


@router.put("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    db.delete(notif)
    db.commit()
    return None


@router.post("/trigger-reminders")
def run_reminder_scan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers the smart reminder engine to scan for overdue doses, upcoming doses, and appointments."""
    check_and_process_reminders(db)
    return {"message": "Reminder engine scan completed."}
