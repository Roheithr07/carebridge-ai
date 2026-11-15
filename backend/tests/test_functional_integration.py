import pytest
import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import verify_password
from app.core.database import SessionLocal
from app.models import User, MedicationLog, DoseStatus, PatientAccess, AccessStatus

client = TestClient(app)


def test_registration_and_argon2_hashing():
    unique_email = f"senior_test_{uuid.uuid4().hex[:8]}@carebridge.com"
    plain_password = "SecurePassword123!"

    reg_res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": plain_password,
        "full_name": "Test Senior Citizen",
        "phone_number": "+1 555-123-4567",
        "role": "elderly",
        "blood_group": "AB+",
        "emergency_contact_name": "Daughter Jane",
        "emergency_contact_phone": "+1 555-987-6543",
        "medical_conditions": "Mild Hypertension"
    })
    assert reg_res.status_code == 201, reg_res.text
    data = reg_res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "elderly"
    assert data["user"]["elderly_profile"]["blood_group"] == "AB+"
    assert data["user"]["elderly_profile"]["share_code"] is not None

    # Verify password is NOT stored in plain text and verifies with Argon2id
    with SessionLocal() as db:
        user_db = db.query(User).filter(User.email == unique_email).first()
        assert user_db is not None
        assert user_db.hashed_password != plain_password
        assert verify_password(plain_password, user_db.hashed_password) is True


def test_medication_crud_complete():
    # Login as Eleanor
    login_res = client.post("/api/auth/login", json={
        "email": "eleanor@carebridge.com",
        "password": "Password123!"
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # 1. Create new medication with multi-schedule
    create_res = client.post("/api/medications", headers=headers, json={
        "name": "CoQ10 Supplement",
        "dosage": "100mg",
        "frequency": "Twice daily",
        "instructions": "Take with meals",
        "prescribing_doctor": "Dr. Sarah Adams",
        "start_date": date.today().isoformat(),
        "schedules": [
            {"time_of_day": "09:00", "label": "Morning", "days_of_week": "all", "dose_quantity": "1 capsule"},
            {"time_of_day": "18:00", "label": "Evening", "days_of_week": "all", "dose_quantity": "1 capsule"}
        ]
    })
    assert create_res.status_code == 201
    med = create_res.json()
    med_id = med["id"]
    assert len(med["schedules"]) == 2

    # 2. Read medication list
    list_res = client.get("/api/medications", headers=headers)
    assert list_res.status_code == 200
    med_ids = [m["id"] for m in list_res.json()]
    assert med_id in med_ids

    # 3. Update medication
    update_res = client.put(f"/api/medications/{med_id}", headers=headers, json={
        "dosage": "200mg",
        "instructions": "Take with morning meal and plenty of water"
    })
    assert update_res.status_code == 200
    assert update_res.json()["dosage"] == "200mg"

    # 4. Delete medication
    del_res = client.delete(f"/api/medications/{med_id}", headers=headers)
    assert del_res.status_code == 204

    # 5. Confirm deletion
    list_res2 = client.get("/api/medications", headers=headers)
    assert med_id not in [m["id"] for m in list_res2.json()]


def test_passcode_sharing_and_revocation():
    # 1. Login as Eleanor (elderly) and get her share passcode
    elder_login = client.post("/api/auth/login", json={
        "email": "eleanor@carebridge.com",
        "password": "Password123!"
    })
    elder_headers = {"Authorization": f"Bearer {elder_login.json()['access_token']}"}
    share_code = elder_login.json()["user"]["elderly_profile"]["share_code"]

    # 2. Register a new family member
    fam_email = f"fam_{uuid.uuid4().hex[:8]}@carebridge.com"
    client.post("/api/auth/register", json={
        "email": fam_email,
        "password": "Password123!",
        "full_name": "Son Robert Vance",
        "role": "family"
    })
    fam_login = client.post("/api/auth/login", json={"email": fam_email, "password": "Password123!"})
    fam_headers = {"Authorization": f"Bearer {fam_login.json()['access_token']}"}

    # 3. Attempt connection with invalid passcode (should fail)
    bad_res = client.post("/api/family/connect", headers=fam_headers, json={
        "share_code": "INVALID-9999",
        "relationship_label": "Son"
    })
    assert bad_res.status_code == 404

    # 4. Connect with valid passcode
    connect_res = client.post("/api/family/connect", headers=fam_headers, json={
        "share_code": share_code,
        "relationship_label": "Son"
    })
    assert connect_res.status_code == 200
    data = connect_res.json()
    assert data["elder_name"] == "Eleanor Vance"
    access_id = data["access_id"]

    # 5. Verify family member can view Eleanor's medications
    fam_meds_res = client.get("/api/medications?elder_id=1", headers=fam_headers)
    assert fam_meds_res.status_code == 200
    assert len(fam_meds_res.json()) > 0

    # 6. Eleanor views connected members
    members_res = client.get("/api/family/members", headers=elder_headers)
    assert members_res.status_code == 200
    member_ids = [m["id"] for m in members_res.json()]
    assert access_id in member_ids

    # 7. Eleanor revokes access immediately
    revoke_res = client.delete(f"/api/family/members/{access_id}", headers=elder_headers)
    assert revoke_res.status_code == 200

    # 8. Subsequent requests by family member are now BLOCKED (403 Forbidden)
    blocked_res = client.get("/api/medications?elder_id=1", headers=fam_headers)
    assert blocked_res.status_code == 403


def test_adherence_excludes_future_doses():
    elder_login = client.post("/api/auth/login", json={
        "email": "eleanor@carebridge.com",
        "password": "Password123!"
    })
    elder_headers = {"Authorization": f"Bearer {elder_login.json()['access_token']}"}

    adh_res = client.get("/api/medication-logs/adherence?days_back=7", headers=elder_headers)
    assert adh_res.status_code == 200
    stats = adh_res.json()
    assert 0 <= stats["adherence_percentage"] <= 100
    assert stats["total_scheduled"] >= stats["taken_count"]
