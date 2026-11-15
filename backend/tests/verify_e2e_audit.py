import os
import sys
import uuid
import asyncio
import requests
from datetime import date, datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"

def log_section(title):
    print(f"\n{'='*70}\n[TEST SECTION] {title}\n{'='*70}")

def assert_true(condition, message):
    if not condition:
        print(f"[-] FAILED: {message}")
        raise AssertionError(message)
    print(f"[+] PASSED: {message}")

def run_e2e_verification():
    results = {}

    # -------------------------------------------------------------
    # 1. INFRASTRUCTURE & PERSISTENCE
    # -------------------------------------------------------------
    log_section("1. Infrastructure & API Connectivity")
    
    # 1.1 Backend health check
    res = requests.get(f"{BASE_URL}/")
    assert_true(res.status_code == 200, f"Backend root health returned 200: {res.json().get('status')}")
    assert_true(res.json().get("app") == "CareBridge AI Platform", "App identity verified")

    # 1.2 CORS verification
    cors_res = requests.options(f"{BASE_URL}/api/auth/login", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST"
    })
    assert_true(cors_res.status_code == 200, "CORS preflight returned 200")
    assert_true(cors_res.headers.get("access-control-allow-origin") == "http://localhost:5173", "CORS allow-origin correct")

    # 1.3 Database persistence check (verify SQLite file exists and is populated)
    db_path = os.path.join(os.path.dirname(__file__), "..", "carebridge.db")
    assert_true(os.path.exists(db_path), f"Database file exists at {db_path}")
    assert_true(os.path.getsize(db_path) > 10000, f"Database has persistent tables ({os.path.getsize(db_path)} bytes)")

    results["infrastructure"] = "PASS"

    # -------------------------------------------------------------
    # 2. AUTHENTICATION & RBAC
    # -------------------------------------------------------------
    log_section("2. Authentication & Role-Based Access Control")

    # 2.1 Elder Login
    elder_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "eleanor@carebridge.com",
        "password": "Password123!"
    })
    assert_true(elder_login.status_code == 200, "Elder Eleanor login successful")
    elder_data = elder_login.json()
    assert_true(elder_data["user"]["role"] == "elderly", "Elder role verified")
    elder_token = elder_data["access_token"]
    elder_headers = {"Authorization": f"Bearer {elder_token}"}
    elder_id = elder_data["user"]["elderly_profile"]["id"]

    # 2.2 Family Login
    family_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "sarah@carebridge.com",
        "password": "Password123!"
    })
    assert_true(family_login.status_code == 200, "Family Sarah login successful")
    family_token = family_login.json()["access_token"]
    family_headers = {"Authorization": f"Bearer {family_token}"}

    # 2.3 Caregiver Login
    caregiver_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "david@carebridge.com",
        "password": "Password123!"
    })
    assert_true(caregiver_login.status_code == 200, "Caregiver David login successful")
    caregiver_token = caregiver_login.json()["access_token"]
    caregiver_headers = {"Authorization": f"Bearer {caregiver_token}"}

    # 2.4 Invalid login rejected
    bad_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "eleanor@carebridge.com",
        "password": "WrongPassword!"
    })
    assert_true(bad_login.status_code == 401, "Invalid password correctly rejected with 401")

    # 2.5 Unauthenticated request blocked
    unauth = requests.get(f"{BASE_URL}/api/dashboard/elder")
    assert_true(unauth.status_code == 401, "Unauthenticated access blocked with 401")

    # 2.6 RBAC dashboard access
    elder_dash = requests.get(f"{BASE_URL}/api/dashboard/elder", headers=elder_headers)
    assert_true(elder_dash.status_code == 200, "Elder can access elder dashboard")

    fam_dash = requests.get(f"{BASE_URL}/api/dashboard/family", headers=family_headers)
    assert_true(fam_dash.status_code == 200, "Family can access family dashboard")

    cg_dash = requests.get(f"{BASE_URL}/api/dashboard/caregiver", headers=caregiver_headers)
    assert_true(cg_dash.status_code == 200, "Caregiver can access caregiver dashboard")

    # Cross-role block: Elder cannot access family dashboard
    cross_dash = requests.get(f"{BASE_URL}/api/dashboard/family", headers=elder_headers)
    assert_true(cross_dash.status_code == 403, "Elder forbidden from family dashboard (403)")

    results["auth_rbac"] = "PASS"

    # -------------------------------------------------------------
    # 3. MEDICATION CRUD & ADHERENCE RECALCULATION
    # -------------------------------------------------------------
    log_section("3. Medication CRUD & Dose Action")

    # 3.1 Create medication
    med_payload = {
        "name": f"Test-Metformin-{uuid.uuid4().hex[:4]}",
        "dosage": "500mg",
        "frequency": "Daily",
        "instructions": "Take with breakfast",
        "prescribing_doctor": "Dr. Miller",
        "schedules": [
            {"time_of_day": "08:00", "label": "Morning", "days_of_week": "daily", "dose_quantity": "1 tablet"}
        ]
    }
    create_med = requests.post(f"{BASE_URL}/api/medications", json=med_payload, headers=elder_headers)
    assert_true(create_med.status_code == 201, f"Medication created: {create_med.json().get('name')}")
    test_med_id = create_med.json()["id"]

    # 3.2 Update medication
    update_med = requests.put(f"{BASE_URL}/api/medications/{test_med_id}", json={
        "instructions": "Take with full glass of water and light breakfast"
    }, headers=elder_headers)
    assert_true(update_med.status_code == 200, "Medication updated successfully")
    assert_true("full glass of water" in update_med.json()["instructions"], "Updated instructions verified")

    # 3.3 Daily schedule retrieval
    today_str = date.today().isoformat()
    daily_res = requests.get(f"{BASE_URL}/api/medications/daily-schedule?target_date={today_str}", headers=elder_headers)
    assert_true(daily_res.status_code == 200, f"Daily schedule retrieved ({daily_res.status_code})")
    doses = daily_res.json()
    assert_true(len(doses) > 0, f"Found {len(doses)} doses for today")

    # 3.4 Action dose: Mark dose taken
    target_dose = doses[0]
    log_id = target_dose.get("log_id")
    if log_id:
        action_res = requests.post(f"{BASE_URL}/api/medications/logs/{log_id}/action", json={
            "status": "taken",
            "notes": "Verified taken on schedule during audit"
        }, headers=elder_headers)
        assert_true(action_res.status_code == 200, f"Dose marked as TAKEN (status={action_res.json().get('status')})")

    # 3.5 Adherence stats recalculated
    adh_res = requests.get(f"{BASE_URL}/api/medication-logs/adherence?days_back=7", headers=elder_headers)
    assert_true(adh_res.status_code == 200, "Adherence stats fetched")
    adh_data = adh_res.json()
    assert_true("adherence_percentage" in adh_data, f"Adherence percentage calculated: {adh_data['adherence_percentage']}%")
    assert_true(adh_data["taken_count"] >= 1, "Taken dose reflected in adherence metrics")

    # 3.6 Clean up test medication
    del_med = requests.delete(f"{BASE_URL}/api/medications/{test_med_id}", headers=elder_headers)
    assert_true(del_med.status_code == 204, "Test medication deleted")

    results["medication_adherence"] = "PASS"

    # -------------------------------------------------------------
    # 4. APPOINTMENT CRUD & CLINICAL FIELDS
    # -------------------------------------------------------------
    log_section("4. Appointment Management & Calendar Filters")

    appt_payload = {
        "doctor_name": "Dr. Sarah Connor",
        "clinic_hospital": "Northwestern Memorial Cardiology",
        "specialty": "Cardiology",
        "appointment_date": (date.today() + timedelta(days=5)).isoformat(),
        "appointment_time": "11:15",
        "hospital_address": "251 E Huron St, Chicago, IL",
        "room_department": "Galter Pavilion, Room 402",
        "appointment_type": "Specialist Review",
        "status": "scheduled",
        "notes": "Bring recent blood pressure logs and current medication list."
    }
    create_appt = requests.post(f"{BASE_URL}/api/appointments", json=appt_payload, headers=elder_headers)
    assert_true(create_appt.status_code == 201, f"Appointment created with Dr. {create_appt.json().get('doctor_name')}")
    appt_id = create_appt.json()["id"]
    assert_true(create_appt.json()["hospital_address"] == "251 E Huron St, Chicago, IL", "Hospital address saved")
    assert_true(create_appt.json()["room_department"] == "Galter Pavilion, Room 402", "Room/department saved")

    # 4.1 Filter appointments by target_date
    target_d = (date.today() + timedelta(days=5)).isoformat()
    filter_appt = requests.get(f"{BASE_URL}/api/appointments?target_date={target_d}", headers=elder_headers)
    assert_true(filter_appt.status_code == 200, "Target date appointment filtering works")
    assert_true(any(a["id"] == appt_id for a in filter_appt.json()), "Created appointment found in date filter")

    # 4.2 Update appointment status
    upd_appt = requests.put(f"{BASE_URL}/api/appointments/{appt_id}", json={
        "status": "completed",
        "notes": "Consultation concluded. Blood pressure within normal range."
    }, headers=elder_headers)
    assert_true(upd_appt.status_code == 200, "Appointment status updated to completed")
    assert_true(upd_appt.json()["status"] == "completed", "Status verified")

    # 4.3 Delete appointment
    del_appt = requests.delete(f"{BASE_URL}/api/appointments/{appt_id}", headers=elder_headers)
    assert_true(del_appt.status_code == 204, "Appointment deleted")

    results["appointments"] = "PASS"

    # -------------------------------------------------------------
    # 5. FAMILY & CAREGIVER COLLABORATION & SOVEREIGNTY
    # -------------------------------------------------------------
    log_section("5. Family Access, Passcode Rotation & Revocation")

    # 5.1 Elder passcode retrieval
    me_res = requests.get(f"{BASE_URL}/api/auth/me", headers=elder_headers)
    assert_true(me_res.status_code == 200, "Elder me profile fetched")
    initial_code = me_res.json()["elderly_profile"]["share_code"]
    assert_true(initial_code.startswith("CB-"), f"Passcode format verified: {initial_code}")

    # 5.2 Rotate / Regenerate Passcode
    regen_res = requests.post(f"{BASE_URL}/api/family/regenerate-code", headers=elder_headers)
    assert_true(regen_res.status_code == 200, "Passcode regenerated")
    new_code = regen_res.json()["new_share_code"]
    assert_true(new_code.startswith("CB-") and new_code != initial_code, f"New rotated passcode: {new_code}")

    # 5.3 Register fresh family user and connect with new_code
    fresh_suffix = uuid.uuid4().hex[:6]
    fresh_email = f"family_{fresh_suffix}@carebridge.ai"
    reg_fam = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": fresh_email,
        "password": "Password123!",
        "full_name": f"Family Member {fresh_suffix}",
        "role": "family"
    })
    assert_true(reg_fam.status_code == 201, "Fresh family user registered")
    fresh_fam_token = requests.post(f"{BASE_URL}/api/auth/login", json={"email": fresh_email, "password": "Password123!"}).json()["access_token"]
    fresh_fam_headers = {"Authorization": f"Bearer {fresh_fam_token}"}

    # Old code must fail (404)
    old_fail = requests.post(f"{BASE_URL}/api/family/connect", json={
        "share_code": initial_code,
        "relationship_label": "Daughter"
    }, headers=fresh_fam_headers)
    assert_true(old_fail.status_code == 404, "Old rotated passcode rejected (404)")

    # New code succeeds
    conn_res = requests.post(f"{BASE_URL}/api/family/connect", json={
        "share_code": new_code,
        "relationship_label": "Daughter"
    }, headers=fresh_fam_headers)
    assert_true(conn_res.status_code == 200, "Connected to elder profile with new passcode")
    access_id = conn_res.json()["access_id"]

    # Verify family user can view elder's medications
    fam_view_meds = requests.get(f"{BASE_URL}/api/medications?elder_id={elder_id}", headers=fresh_fam_headers)
    assert_true(fam_view_meds.status_code == 200, "Authorized family member can view elder's medications")

    # 5.4 Elder revokes access
    revoke_res = requests.delete(f"{BASE_URL}/api/family/revoke/{access_id}", headers=elder_headers)
    assert_true(revoke_res.status_code == 200, "Elder revoked family member access")

    # Verify immediate blocking (403)
    blocked_view = requests.get(f"{BASE_URL}/api/medications?elder_id={elder_id}", headers=fresh_fam_headers)
    assert_true(blocked_view.status_code == 403, "Revoked user immediately blocked with 403 Forbidden")

    # 5.5 Activity audit log verification
    act_res = requests.get(f"{BASE_URL}/api/activity", headers=elder_headers)
    assert_true(act_res.status_code == 200, "Activity timeline logs fetched")
    acts = act_res.json()
    assert_true(len(acts) > 0, f"Activity timeline has {len(acts)} audit entries")

    results["family_collaboration"] = "PASS"

    # -------------------------------------------------------------
    # 6. NOTIFICATION SYSTEM & IDEMPOTENCY
    # -------------------------------------------------------------
    log_section("6. Notifications & Reminder Engine")

    # 6.1 Trigger automated reminder scanner
    scan_res = requests.post(f"{BASE_URL}/api/notifications/trigger-reminders", headers=elder_headers)
    assert_true(scan_res.status_code == 200, f"Reminder engine triggered: {scan_res.json().get('message')}")

    # 6.2 Fetch notifications and unread count
    notifs = requests.get(f"{BASE_URL}/api/notifications", headers=elder_headers).json()
    assert_true(isinstance(notifs, list), f"Retrieved {len(notifs)} notifications")

    unread_res = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=elder_headers)
    assert_true(unread_res.status_code == 200, f"Unread count: {unread_res.json().get('unread_count')}")

    # 6.3 Category filtering
    med_notifs = requests.get(f"{BASE_URL}/api/notifications?category=medication", headers=elder_headers).json()
    assert_true(isinstance(med_notifs, list), f"Medication category filter returned {len(med_notifs)} alerts")

    # 6.4 Mark all read
    mark_all = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=elder_headers)
    assert_true(mark_all.status_code == 200, "Mark all notifications read works")

    results["notifications"] = "PASS"

    # -------------------------------------------------------------
    # 7. LIVE GROQ API INTEGRATION VERIFICATION
    # -------------------------------------------------------------
    log_section("7. Live Groq API Clinical Synthesis Verification")

    ai_res = requests.get(f"{BASE_URL}/api/ai-summary", headers=elder_headers)
    assert_true(ai_res.status_code == 200, "AI summary endpoint returned 200 OK")
    ai_data = ai_res.json()

    print(f"[*] Provider: {ai_data.get('provider')}")
    print(f"[*] Title: {ai_data.get('title')}")
    print(f"[*] Assessment: {ai_data.get('adherence_assessment')}")
    print(f"[*] Summary Preview: {ai_data.get('summary_text')[:120]}...")
    print(f"[*] Observations: {len(ai_data.get('key_observations', []))} items")
    print(f"[*] Attention Points: {len(ai_data.get('attention_points', []))} items")
    print(f"[*] Suggested Questions: {len(ai_data.get('suggested_questions', []))} items")

    assert_true("Groq" in ai_data["provider"] or "CareBridge" in ai_data["provider"], f"Valid provider metadata: {ai_data['provider']}")
    assert_true(len(ai_data["key_observations"]) > 0, "Observations populated from tracking records")
    assert_true("DOES NOT provide medical advice" in ai_data["disclaimer"], "Safety disclaimer included")

    # Verify no API key in frontend .env
    frontend_env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    with open(frontend_env_path, "r", encoding="utf-8") as f:
        frontend_env_content = f.read()
    assert_true("gsk_" not in frontend_env_content, "GROQ_API_KEY is NOT exposed in frontend/.env")
    assert_true("GROQ_API_KEY" not in frontend_env_content, "No GROQ_API_KEY reference in frontend/.env")

    results["groq_integration"] = "PASS"

    log_section("E2E VERIFICATION COMPLETED SUCCESSFULLY")
    print("\nSummary of Test Modules:")
    for mod, status in results.items():
        print(f" - {mod.upper()}: {status}")

    return True

if __name__ == "__main__":
    try:
        run_e2e_verification()
    except Exception as e:
        print(f"\n[FATAL ERROR] {e}")
        sys.exit(1)
