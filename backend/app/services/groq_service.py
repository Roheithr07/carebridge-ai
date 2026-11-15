import json
import logging
from typing import Dict, Any, Optional, List
from groq import AsyncGroq, RateLimitError, AuthenticationError, NotFoundError, APIConnectionError, APITimeoutError
from app.core.config import settings

logger = logging.getLogger("carebridge.groq")

# Safe fallback models if primary model is unavailable or encounters 404
FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "allam-2-7b"
]

CLINICAL_SAFETY_SYSTEM_PROMPT = """You are the Groq Clinical Summary Assistant for CareBridge AI, an elderly healthcare and medication management platform.
Your purpose is to synthesize tracked patient logs into clear, organized, empathetic observations for family members and caregivers.

CRITICAL SAFETY & REGULATORY RULES:
1. NEVER diagnose diseases, conditions, or symptoms.
2. NEVER prescribe, recommend changing, or suggest altering medications, dosages, or schedules.
3. CLEARLY distinguish recorded tracking facts from AI observations.
4. Always provide practical questions the patient or family can ask their certified physician.
5. You must output ONLY a valid JSON object matching the requested schema. No markdown formatting around the JSON, no extra prose outside the JSON.

JSON Schema format:
{
  "title": "Clinical Activity & Adherence Summary for [Patient Name]",
  "summary_text": "A concise 2-3 sentence executive overview of the past 7 days.",
  "adherence_assessment": "e.g. Excellent Adherence (95%) or Moderate Adherence (78%)",
  "key_observations": [
    "Observation 1 regarding adherence and dose timing",
    "Observation 2 regarding missed doses if any"
  ],
  "upcoming_action_items": [
    "Action 1 regarding upcoming doctor appointments or refills"
  ],
  "caregiver_recommendations": [
    "Recommendation 1 for caregiver routine and support"
  ],
  "attention_points": [
    "Attention point 1 regarding notable trends or reminders"
  ],
  "suggested_questions": [
    "Question 1 to ask physician during the next consultation",
    "Question 2 regarding monitored symptoms or medication tolerance"
  ]
}
"""


class GroqService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL or "openai/gpt-oss-120b"
        self._client: Optional[AsyncGroq] = None

    @property
    def client(self) -> AsyncGroq:
        if not self._client:
            self._client = AsyncGroq(api_key=self.api_key or "dummy_key", timeout=15.0)
        return self._client

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.startswith("gsk_"))

    async def generate_summary(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes asynchronous Groq LLM call with strict safety guardrails.
        Raises exception if unconfigured or failed, allowing caller to invoke deterministic fallback.
        """
        if not self.is_configured():
            raise ValueError("Groq API key is not configured or invalid.")

        user_prompt = f"""Synthesize this verified patient tracking dataset into the structured JSON schema:

PATIENT PROFILE:
- Name: {patient_context.get('patient_name', 'Patient')}
- Monitored Health Conditions: {patient_context.get('medical_conditions', 'None reported')}
- Known Allergies: {patient_context.get('allergies', 'None')}

7-DAY MEDICATION ADHERENCE METRICS:
- Overall Adherence Rate: {patient_context.get('adherence_rate', 100.0)}%
- Total Doses Due: {patient_context.get('total_due', 0)}
- Doses Taken: {patient_context.get('taken_count', 0)}
- Doses Missed (Past Grace Period): {patient_context.get('missed_count', 0)}
- Doses Skipped: {patient_context.get('skipped_count', 0)}

ACTIVE MEDICATIONS & SCHEDULES:
{patient_context.get('medications_text', 'None recorded')}

UPCOMING DOCTOR VISITS:
{patient_context.get('appointments_text', 'No upcoming appointments')}

RECENT AUDIT ACTIVITY:
{patient_context.get('recent_activities_text', 'No recent logs')}

Produce the JSON object according to the system instructions.
"""

        models_to_try = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]
        last_error = None

        for target_model in models_to_try:
            try:
                logger.info(f"Invoking Groq API using model '{target_model}'...")
                completion = await self.client.chat.completions.create(
                    model=target_model,
                    messages=[
                        {"role": "system", "content": CLINICAL_SAFETY_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"}
                )

                content = completion.choices[0].message.content
                if not content:
                    raise ValueError("Groq returned empty response content.")

                data = json.loads(content)
                data["_model_used"] = target_model
                return data

            except NotFoundError as e:
                logger.warning(f"Groq model '{target_model}' not found (404), trying fallback model: {e}")
                last_error = e
                continue
            except (RateLimitError, AuthenticationError, APITimeoutError, APIConnectionError) as e:
                logger.error(f"Groq API error on model '{target_model}': {e}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error calling Groq API: {e}")
                raise

        raise last_error or RuntimeError("All Groq models failed.")


# Singleton service instance
groq_service = GroqService()

