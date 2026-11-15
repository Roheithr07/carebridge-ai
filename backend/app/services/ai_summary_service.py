import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import (
    ElderlyProfile, Medication, MedicationSchedule, MedicationLog, DoseStatus, 
    Appointment, AppointmentStatus, ActivityLog
)
from app.schemas import AISummaryResponse
from app.core.config import settings
from app.services.groq_service import groq_service

logger = logging.getLogger("carebridge.ai_summary")

MEDICAL_SAFETY_DISCLAIMER = (
    "DISCLAIMER: CareBridge AI healthcare summaries are generated exclusively from recorded tracking data "
    "to assist family members and caregivers with routine coordination. CareBridge AI DOES NOT provide medical advice, "
    "clinical diagnoses, treatment prescriptions, or dosage recommendations. Always consult a licensed physician "
    "or qualified healthcare professional for medical decisions."
)


def gather_patient_context(db: Session, elder_id: int) -> Dict[str, Any]:
    """
    Extracts verified, sanitized tracking records from the database for Groq AI synthesis.
    Strictly excludes sensitive tokens, passwords, and unnecessary PII.
    """
    profile = db.query(ElderlyProfile).filter(ElderlyProfile.id == elder_id).first()
    elder_name = profile.user.full_name if profile and profile.user else "Patient"

    today = date.today()
    week_ago = today - timedelta(days=7)

    # 1. Medications and Schedules
    meds = db.query(Medication).filter(Medication.elder_id == elder_id).all()
    med_lines = []
    for m in meds:
        scheds = [s.time_of_day for s in m.schedules if s.is_active]
        sched_str = f" [Times: {', '.join(scheds)}]" if scheds else ""
        doc_str = f" (Prescribing: {m.prescribing_doctor})" if m.prescribing_doctor else ""
        med_lines.append(f"- {m.name} ({m.dosage}) - Frequency: {m.frequency}{sched_str}{doc_str}")

    medications_text = "\n".join(med_lines) if med_lines else "No active medications recorded."

    # 2. 7-Day Dose Tracking Logs
    logs_week = db.query(MedicationLog).filter(
        MedicationLog.elder_id == elder_id,
        MedicationLog.scheduled_date >= week_ago,
        MedicationLog.scheduled_date <= today
    ).all()

    total_due = len(logs_week)
    taken = sum(1 for l in logs_week if l.status == DoseStatus.TAKEN)
    skipped = sum(1 for l in logs_week if l.status == DoseStatus.SKIPPED)
    missed = sum(1 for l in logs_week if l.status == DoseStatus.MISSED)
    adherence_pct = round((taken / total_due * 100), 1) if total_due > 0 else 100.0

    # 3. Upcoming Appointments (next 30 days)
    upcoming_appts = db.query(Appointment).filter(
        Appointment.elder_id == elder_id,
        Appointment.appointment_date >= today,
        Appointment.status == AppointmentStatus.SCHEDULED
    ).order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).limit(5).all()

    appt_lines = []
    for a in upcoming_appts:
        addr_str = f" at {a.hospital_address}" if a.hospital_address else ""
        room_str = f" ({a.room_department})" if a.room_department else ""
        notes_str = f" - Notes: {a.notes}" if a.notes else ""
        appt_lines.append(f"- Dr. {a.doctor_name} ({a.specialty or 'General'}) on {a.appointment_date.strftime('%b %d, %Y')} at {a.appointment_time} - {a.clinic_hospital}{room_str}{addr_str}{notes_str}")

    appointments_text = "\n".join(appt_lines) if appt_lines else "No upcoming doctor appointments scheduled."

    # 4. Recent Health Audit Activity (last 6 entries)
    recent_acts = db.query(ActivityLog).filter(
        ActivityLog.elder_id == elder_id
    ).order_by(ActivityLog.created_at.desc()).limit(6).all()

    act_lines = [f"- {act.created_at.strftime('%b %d %H:%M')}: {act.description}" for act in recent_acts]
    recent_activities_text = "\n".join(act_lines) if act_lines else "No recent activity entries."

    return {
        "patient_name": elder_name,
        "medical_conditions": profile.medical_conditions or "None recorded",
        "allergies": profile.allergies or "None recorded",
        "adherence_rate": adherence_pct,
        "total_due": total_due,
        "taken_count": taken,
        "missed_count": missed,
        "skipped_count": skipped,
        "medications_text": medications_text,
        "appointments_text": appointments_text,
        "recent_activities_text": recent_activities_text,
        "raw_meds": meds,
        "raw_appts": upcoming_appts
    }


def generate_rule_based_fallback(context: Dict[str, Any]) -> AISummaryResponse:
    """
    Deterministic clinical summary used when Groq API is unavailable, unconfigured, or timed out.
    Provides identical schema guarantees and complete safety.
    """
    elder_name = context["patient_name"]
    pct = context["adherence_rate"]
    taken = context["taken_count"]
    missed = context["missed_count"]
    skipped = context["skipped_count"]
    total = context["total_due"]
    meds = context["raw_meds"]
    appts = context["raw_appts"]

    if pct >= 90:
        assessment = f"Excellent Adherence ({pct}%)"
    elif pct >= 75:
        assessment = f"Moderate Adherence ({pct}%)"
    else:
        assessment = f"Attention Required ({pct}%)"

    observations = [
        f"{elder_name} achieved an overall medication adherence rate of {pct}% over the past 7 days ({taken} of {total} doses confirmed taken).",
        f"{missed} dose(s) exceeded the configured reminder grace window and were flagged as missed." if missed > 0 else "Zero doses exceeded the reminder grace window during the evaluation cycle.",
        f"{len(meds)} active recurring medications are actively managed in CareBridge AI."
    ]

    actions = []
    if appts:
        first_a = appts[0]
        actions.append(f"Attend scheduled visit with Dr. {first_a.doctor_name} ({first_a.specialty}) on {first_a.appointment_date.strftime('%B %d, %Y')} at {first_a.appointment_time}.")
    else:
        actions.append("No medical consultations currently scheduled for the next 14 days.")

    actions.append("Verify weekly pill organizers match the active prescription schedule in CareBridge.")

    recommendations = [
        f"Continue supporting {elder_name} with daily schedule confirmation via the mobile/web interface.",
        "Ensure emergency contact details and allergy profiles remain updated.",
        "Confirm prescription refill supplies before upcoming holiday or travel periods."
    ]

    attention_points = [
        f"7-day adherence is currently at {pct}%. Consistent adherence supports cardiovascular and metabolic stability.",
        f"Missed doses: {missed}. Any consistent missed timing should be reviewed for schedule adjustments."
    ]

    questions = [
        f"Are there any side effects or fatigue associated with the current daily medication regimen?",
        f"Should any medication schedules be adjusted around meal times or sleep patterns?",
        f"Are all current prescriptions still necessary, or can dosages be optimized?"
    ]

    summary_text = (
        f"Over the past 7 days, {elder_name} maintained a {pct}% medication adherence rate across {len(meds)} active prescriptions. "
        f"{'Upcoming clinical visits are on schedule.' if appts else 'No immediate consultations are scheduled.'} "
        f"Family and caregivers should continue routine verification to prevent missed doses."
    )

    return AISummaryResponse(
        title=f"Clinical Activity & Adherence Summary for {elder_name}",
        summary_text=summary_text,
        adherence_assessment=assessment,
        key_observations=observations,
        upcoming_action_items=actions,
        caregiver_recommendations=recommendations,
        attention_points=attention_points,
        suggested_questions=questions,
        disclaimer=MEDICAL_SAFETY_DISCLAIMER,
        provider="CareBridge Clinical Engine (Safe Fallback)",
        generated_at=datetime.now(timezone.utc)
    )


async def generate_ai_healthcare_summary(db: Session, elder_id: int) -> AISummaryResponse:
    """
    Main entry point for generating the clinical healthcare summary.
    Attempts Groq LLM synthesis first; seamlessly falls back to the deterministic engine
    if Groq is unreachable, timed out, or unconfigured.
    """
    context = gather_patient_context(db, elder_id)

    if groq_service.is_configured():
        try:
            groq_data = await groq_service.generate_summary(context)
            model_used = groq_data.get("_model_used", settings.GROQ_MODEL)

            return AISummaryResponse(
                title=groq_data.get("title", f"Clinical Summary for {context['patient_name']}"),
                summary_text=groq_data.get("summary_text", "Summary of weekly healthcare activity."),
                adherence_assessment=groq_data.get("adherence_assessment", f"Adherence: {context['adherence_rate']}%"),
                key_observations=groq_data.get("key_observations") or [f"7-day adherence: {context['adherence_rate']}%"],
                upcoming_action_items=groq_data.get("upcoming_action_items") or ["Review upcoming appointments."],
                caregiver_recommendations=groq_data.get("caregiver_recommendations") or ["Maintain routine care checks."],
                attention_points=groq_data.get("attention_points") or [f"Current adherence: {context['adherence_rate']}%"],
                suggested_questions=groq_data.get("suggested_questions") or ["Ask physician regarding medication tolerance."],
                disclaimer=MEDICAL_SAFETY_DISCLAIMER,
                provider=f"Groq ({model_used})",
                generated_at=datetime.now(timezone.utc)
            )

        except Exception as e:
            logger.warning(f"Groq API synthesis failed: {e}. Falling back to deterministic clinical engine.")

    # Safe deterministic fallback
    return generate_rule_based_fallback(context)
