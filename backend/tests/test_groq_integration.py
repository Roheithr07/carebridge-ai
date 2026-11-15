import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.groq_service import GroqService, groq_service
from app.core.config import settings

client = TestClient(app)


def get_token(email: str = "eleanor@carebridge.com", password: str = "Password123!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_groq_service_direct_synthesis():
    # Verify Groq service directly synthesizes a structured patient payload
    assert groq_service.is_configured() is True

    context = {
        "patient_name": "Eleanor Vance",
        "medical_conditions": "Hypertension, Mild Osteoarthritis",
        "allergies": "Penicillin",
        "adherence_rate": 92.5,
        "total_due": 14,
        "taken_count": 13,
        "missed_count": 1,
        "skipped_count": 0,
        "medications_text": "- Lisinopril (10mg) - Frequency: Daily (Morning)\n- Atorvastatin (20mg) - Frequency: Daily (Bedtime)",
        "appointments_text": "- Dr. Robert Hayes (Cardiology) on Nov 25, 2026 at 10:00 - Mercy Heart Institute",
        "recent_activities_text": "- Confirmed morning dose of Lisinopril\n- Scheduled routine follow-up"
    }

    import asyncio
    result = asyncio.run(groq_service.generate_summary(context))
    assert isinstance(result, dict)
    assert "title" in result
    assert "summary_text" in result
    assert "adherence_assessment" in result
    assert "key_observations" in result
    assert isinstance(result["key_observations"], list)
    assert len(result["key_observations"]) > 0
    assert "_model_used" in result


def test_ai_summary_endpoint_authenticated():
    token = get_token("eleanor@carebridge.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/ai-summary", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert "Eleanor" in data["title"] or "Clinical" in data["title"] or "Summary" in data["title"]
    assert len(data["summary_text"]) > 20
    assert "adherence_assessment" in data
    assert len(data["key_observations"]) >= 1
    assert len(data["upcoming_action_items"]) >= 1
    assert len(data["caregiver_recommendations"]) >= 1
    assert "disclaimer" in data
    assert "DOES NOT provide medical advice" in data["disclaimer"]
    assert "Groq" in data["provider"] or "CareBridge" in data["provider"]


def test_ai_summary_fallback_on_invalid_key(monkeypatch):
    # Simulate invalid Groq API key or network fault
    invalid_service = GroqService(api_key="gsk_invalid_test_key_1234567890")
    monkeypatch.setattr("app.services.ai_summary_service.groq_service", invalid_service)

    token = get_token("eleanor@carebridge.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Should still return 200 with deterministic fallback
    res = client.get("/api/ai-summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "Safe Fallback" in data["provider"]
    assert len(data["key_observations"]) >= 1
    assert "disclaimer" in data


def test_ai_summary_unauthorized_blocked():
    # No auth header
    res = client.get("/api/ai-summary")
    assert res.status_code == 401

