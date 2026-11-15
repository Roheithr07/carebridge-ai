import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_headers(email: str = "eleanor@carebridge.com", password: str = "Password123!"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_and_root():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["app"] == "CareBridge AI Platform"


def test_auth_login_demo_users():
    # 1. Elder Eleanor
    res = client.post("/api/auth/login", json={
        "email": "eleanor@carebridge.com",
        "password": "Password123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "elderly"
    assert data["user"]["elderly_profile"]["share_code"].startswith("CB-")

    # 2. Family Sarah
    res = client.post("/api/auth/login", json={
        "email": "sarah@carebridge.com",
        "password": "Password123!"
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "family"

    # 3. Caregiver David
    res = client.post("/api/auth/login", json={
        "email": "david@carebridge.com",
        "password": "Password123!"
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "caregiver"


def test_elder_dashboard_and_medications():
    headers = get_auth_headers("eleanor@carebridge.com")

    # Fetch dashboard
    dash_res = client.get("/api/dashboard/elder", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "profile" in dash_data
    assert "adherence" in dash_data
    assert dash_data["adherence"]["adherence_percentage"] > 0

    # Fetch daily schedule
    sched_res = client.get("/api/medications/daily-schedule", headers=headers)
    assert sched_res.status_code == 200
    doses = sched_res.json()
    assert len(doses) > 0


def test_family_dashboard():
    headers = get_auth_headers("sarah@carebridge.com")

    dash_res = client.get("/api/dashboard/family", headers=headers)
    assert dash_res.status_code == 200
    data = dash_res.json()
    assert len(data["connected_patients"]) >= 1
    assert data["connected_patients"][0]["elder_name"] == "Eleanor Vance"


def test_caregiver_dashboard():
    headers = get_auth_headers("david@carebridge.com")

    dash_res = client.get("/api/dashboard/caregiver", headers=headers)
    assert dash_res.status_code == 200
    data = dash_res.json()
    assert len(data["assigned_patients"]) >= 1
    assert "today_schedule" in data


def test_dose_action_and_adherence():
    headers = get_auth_headers("eleanor@carebridge.com")

    # Get daily schedule
    sched_res = client.get("/api/medications/daily-schedule", headers=headers)
    doses = sched_res.json()
    assert len(doses) > 0
    target_dose = doses[0]
    log_id = target_dose["log_id"]

    # Mark dose as taken
    action_res = client.post(
        f"/api/medications/logs/{log_id}/action",
        headers=headers,
        json={"status": "taken", "notes": "Taken with glass of water"}
    )
    assert action_res.status_code == 200
    assert action_res.json()["status"] == "taken"

    # Verify adherence calculation
    adh_res = client.get("/api/medication-logs/adherence", headers=headers)
    assert adh_res.status_code == 200
    adh_data = adh_res.json()
    assert adh_data["adherence_percentage"] > 0
    assert len(adh_data["daily_history"]) > 0


def test_appointments_crud():
    headers = get_auth_headers("eleanor@carebridge.com")

    # Create appointment
    create_res = client.post(
        "/api/appointments",
        headers=headers,
        json={
            "doctor_name": "Dr. Sarah Adams",
            "clinic_hospital": "Beacon Hill Medical Center",
            "specialty": "Geriatrics",
            "appointment_date": (date.today() + timedelta(days=5)).isoformat(),
            "appointment_time": "14:30",
            "appointment_type": "Wellness Assessment",
            "notes": "Discuss physical therapy progression"
        }
    )
    assert create_res.status_code == 201
    appt = create_res.json()
    appt_id = appt["id"]

    # Update appointment
    update_res = client.put(
        f"/api/appointments/{appt_id}",
        headers=headers,
        json={"notes": "Updated: bring knee brace"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["notes"] == "Updated: bring knee brace"

    # Delete appointment
    del_res = client.delete(f"/api/appointments/{appt_id}", headers=headers)
    assert del_res.status_code == 204


def test_ai_summary_endpoint():
    headers = get_auth_headers("eleanor@carebridge.com")
    res = client.get("/api/ai-summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "adherence_assessment" in data
    assert "disclaimer" in data
    assert len(data["key_observations"]) > 0


def test_notifications_and_reminders():
    headers = get_auth_headers("eleanor@carebridge.com")

    # Trigger scan
    scan_res = client.post("/api/notifications/trigger-reminders", headers=headers)
    assert scan_res.status_code == 200

    # Get notifications
    notif_res = client.get("/api/notifications", headers=headers)
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert len(notifs) > 0

    # Read all
    read_res = client.put("/api/notifications/read-all", headers=headers)
    assert read_res.status_code == 200


def test_unauthorized_access_blocked():
    # Register a new isolated user
    client.post("/api/auth/register", json={
        "email": "intruder2@carebridge.com",
        "password": "Password123!",
        "full_name": "Intruder User",
        "role": "family"
    })
    login_res = client.post("/api/auth/login", json={
        "email": "intruder2@carebridge.com",
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Try to access Eleanor's medications (elder_id=1) without permission
    meds_res = client.get("/api/medications?elder_id=1", headers=headers)
    assert meds_res.status_code == 403 # Forbidden!
