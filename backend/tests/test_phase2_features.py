import uuid
from datetime import date, datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db
from app.models import (
    User, UserRole, ElderlyProfile, Appointment, AppointmentStatus,
    Medication, MedicationSchedule, MedicationLog, DoseStatus, Notification, NotificationType,
    PatientAccess, AccessStatus, ActionType, ActivityLog
)
from app.services.reminder_engine import check_and_process_reminders
from app.services.email_service import (
    send_upcoming_medication_email,
    send_missed_dose_email,
    send_appointment_email,
    send_family_connection_email,
    send_caregiver_connection_email
)

client = TestClient(app)


def get_auth_token(email: str = "eleanor@carebridge.com", password: str = "Password123!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_appointment_full_crud_and_fields():
    token = get_auth_token("eleanor@carebridge.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create appointment with full fields (hospital_address, room_department)
    appt_data = {
        "doctor_name": "Dr. Sarah Connor",
        "clinic_hospital": "St. Jude Cardiovascular Center",
        "specialty": "Cardiology",
        "appointment_date": (date.today() + timedelta(days=2)).isoformat(),
        "appointment_time": "14:30",
        "hospital_address": "800 Mercy Way, Chicago, IL",
        "room_department": "West Wing, Suite 410",
        "appointment_type": "Specialist Review",
        "status": "scheduled",
        "notes": "Bring 7-day blood pressure log and fasting report."
    }

    create_res = client.post("/api/appointments", json=appt_data, headers=headers)
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    appt_id = created["id"]
    assert created["doctor_name"] == "Dr. Sarah Connor"
    assert created["hospital_address"] == "800 Mercy Way, Chicago, IL"
    assert created["room_department"] == "West Wing, Suite 410"
    assert created["status"] == "scheduled"

    # 2. Get appointments with target_date filter
    target_d = (date.today() + timedelta(days=2)).isoformat()
    list_res = client.get(f"/api/appointments?target_date={target_d}", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(a["id"] == appt_id for a in items)

    # 3. Update appointment
    update_res = client.put(f"/api/appointments/{appt_id}", json={
        "room_department": "West Wing, Suite 412",
        "status": "completed",
        "notes": "Consultation concluded. Prescriptions renewed."
    }, headers=headers)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["room_department"] == "West Wing, Suite 412"
    assert updated["status"] == "completed"

    # 4. Delete appointment
    del_res = client.delete(f"/api/appointments/{appt_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify not in list
    check_res = client.get(f"/api/appointments?target_date={target_d}", headers=headers)
    assert all(a["id"] != appt_id for a in check_res.json())


def test_family_and_caregiver_passcode_collaboration():
    # Register a new fresh elder
    unique_suffix = uuid.uuid4().hex[:8]
    elder_email = f"elder_{unique_suffix}@carebridge.ai"
    reg_res = client.post("/api/auth/register", json={
        "email": elder_email,
        "password": "Password123!",
        "full_name": "Eleanor Vance",
        "role": "elderly",
        "phone_number": "+1-555-0199"
    })
    assert reg_res.status_code == 201

    elder_token = get_auth_token(elder_email, "Password123!")
    elder_headers = {"Authorization": f"Bearer {elder_token}"}

    # Verify elder gets a unique CB-XXXXXX passcode
    me_res = client.get("/api/auth/me", headers=elder_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    original_code = me_data["elderly_profile"]["share_code"]
    assert original_code.startswith("CB-")

    # Regenerate passcode
    regen_res = client.post("/api/family/regenerate-code", headers=elder_headers)
    assert regen_res.status_code == 200
    new_code = regen_res.json()["new_share_code"]
    assert new_code.startswith("CB-")
    assert new_code != original_code

    # Register a family member and connect using new_code
    family_email = f"family_{unique_suffix}@carebridge.ai"
    fam_reg = client.post("/api/auth/register", json={
        "email": family_email,
        "password": "Password123!",
        "full_name": "Thomas Vance",
        "role": "family"
    })
    assert fam_reg.status_code == 201

    fam_token = get_auth_token(family_email, "Password123!")
    fam_headers = {"Authorization": f"Bearer {fam_token}"}

    # Old code should fail
    fail_res = client.post("/api/family/connect", json={
        "share_code": original_code,
        "relationship_label": "Son"
    }, headers=fam_headers)
    assert fail_res.status_code == 404

    # New code succeeds
    connect_res = client.post("/api/family/connect", json={
        "share_code": new_code,
        "relationship_label": "Son"
    }, headers=fam_headers)
    assert connect_res.status_code == 200
    access_data = connect_res.json()
    access_id = access_data["access_id"]

    # Verify family member can view elder's medications
    elder_id = me_data["elderly_profile"]["id"]
    fam_meds = client.get(f"/api/medications?elder_id={elder_id}", headers=fam_headers)
    assert fam_meds.status_code == 200

    # Elderly revokes family member's access
    revoke_res = client.delete(f"/api/family/revoke/{access_id}", headers=elder_headers)
    assert revoke_res.status_code == 200

    # Family member is now forbidden from accessing elder's medications
    blocked_meds = client.get(f"/api/medications?elder_id={elder_id}", headers=fam_headers)
    assert blocked_meds.status_code == 403

    # And elder is no longer in family connected_patients
    fam_dash = client.get("/api/dashboard/family", headers=fam_headers)
    assert fam_dash.status_code == 200
    assert all(p["elder_id"] != elder_id for p in fam_dash.json()["connected_patients"])


def test_automated_reminder_engine_and_notification_endpoints():
    db: Session = next(get_db())
    try:
        # Find elder user
        elder_user = db.query(User).filter(User.email == "eleanor@carebridge.com").first()
        assert elder_user is not None
        elder_id = elder_user.elderly_profile.id

        # 1. Create a dose that was due 45 minutes ago (past 30-min grace period)
        now = datetime.now()
        past_time = (now - timedelta(minutes=45)).strftime("%H:%M")
        today = date.today()

        # Find or create a medication
        med = db.query(Medication).filter(Medication.elder_id == elder_id).first()
        assert med is not None

        # Create past due log
        test_log = MedicationLog(
            medication_id=med.id,
            elder_id=elder_id,
            scheduled_date=today,
            scheduled_time=past_time,
            status=DoseStatus.PENDING
        )
        db.add(test_log)

        # 2. Create an appointment in 23 hours (should trigger 24h reminder)
        appt_24h = Appointment(
            elder_id=elder_id,
            created_by_user_id=elder_user.id,
            doctor_name="Dr. Automated Test",
            clinic_hospital="Test Cardiology Clinic",
            appointment_date=today + timedelta(days=1),
            appointment_time=(now - timedelta(hours=1)).strftime("%H:%M"),
            appointment_type="Consultation",
            status=AppointmentStatus.SCHEDULED,
            reminder_sent=False
        )
        db.add(appt_24h)
        db.commit()

        # Execute the reminder engine directly
        stats = check_and_process_reminders(db)
        assert isinstance(stats, dict)
        assert "upcoming_med_reminders" in stats
        assert "missed_dose_alerts" in stats
        assert "appointment_reminders" in stats

        # Re-query test_log to see status transitioned to MISSED
        db.refresh(test_log)
        assert test_log.status == DoseStatus.MISSED

        # Clean up test log
        db.delete(test_log)
        db.delete(appt_24h)
        db.commit()

    finally:
        db.close()

    # 3. Test Notification API with category filtering
    token = get_auth_token("eleanor@carebridge.com")
    headers = {"Authorization": f"Bearer {token}"}

    # All notifications
    all_notifs = client.get("/api/notifications", headers=headers).json()
    assert isinstance(all_notifs, list)

    # Category filter: medication
    med_notifs = client.get("/api/notifications?category=medication", headers=headers).json()
    assert isinstance(med_notifs, list)
    assert all(n["notification_type"] in ["medication_reminder", "missed_dose"] for n in med_notifs)

    # Category filter: appointment
    appt_notifs = client.get("/api/notifications?category=appointment", headers=headers).json()
    assert isinstance(appt_notifs, list)
    assert all(n["notification_type"] == "appointment_reminder" for n in appt_notifs)

    # Unread count endpoint
    unread_res = client.get("/api/notifications/unread-count", headers=headers)
    assert unread_res.status_code == 200
    assert "unread_count" in unread_res.json()

    # Test single notification delete if notifications exist
    if len(all_notifs) > 0:
        nid = all_notifs[0]["id"]
        del_res = client.delete(f"/api/notifications/{nid}", headers=headers)
        assert del_res.status_code == 204


def test_email_service_templates_and_dispatch():
    # Test that each of the 5 email service functions executes safely without throwing exceptions
    send_upcoming_medication_email(
        to_email="patient@example.com",
        elder_name="Margaret Higgins",
        med_name="Lisinopril",
        dosage="10mg",
        scheduled_time="08:00 AM",
        instructions="Take with water before breakfast."
    )

    send_missed_dose_email(
        to_email="family@example.com",
        recipient_name="Sarah Higgins",
        elder_name="Margaret Higgins",
        med_name="Metformin",
        dosage="500mg",
        scheduled_time="12:00 PM"
    )

    send_appointment_email(
        to_email="patient@example.com",
        recipient_name="Margaret Higgins",
        elder_name="Margaret Higgins",
        doctor_name="Dr. Robert Hayes",
        specialty="Cardiology",
        appt_date="Nov 20, 2026",
        appt_time="10:30 AM",
        hospital="Mercy Heart & Vascular Institute",
        address="1200 Healthcare Blvd, Suite 400"
    )

    send_family_connection_email(
        to_email="family@example.com",
        member_name="Sarah Higgins",
        elder_name="Margaret Higgins",
        relationship="Daughter"
    )

    send_caregiver_connection_email(
        to_email="caregiver@carebridge.ai",
        caregiver_name="Nurse David Miller",
        elder_name="Margaret Higgins"
    )
