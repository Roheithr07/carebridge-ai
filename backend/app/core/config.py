import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CareBridge AI"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "carebridge_ai_super_secret_jwt_key_catalyst_hackathon_2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    ALGORITHM: str = "HS256"

    # Environment & Cloud Run Server Configuration
    ENVIRONMENT: str = "development" # "development" | "production"
    PORT: int = 8080
    AUTO_SEED_DEMO_DATA: bool = True

    # Database Configuration (Supports SQLite and Cloud SQL / PostgreSQL)
    DATABASE_URL: str = "sqlite:///./carebridge.db"

    # Notification & Reminders
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "alerts@carebridge-ai.com"
    EMAILS_FROM_NAME: str = "CareBridge AI Alerts"
    ENABLE_EMAIL_ALERTS: bool = False
    GRACE_PERIOD_MINUTES: int = 30 # Time after scheduled dose to trigger missed dose alert

    # AI Configuration (Official Groq API)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    AI_PROVIDER: str = "groq"
    AI_API_KEY: str = ""
    GROK_API_KEY: str = ""

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://carebridge-ai.vercel.app"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_strip = v.strip()
            if not v_strip:
                return []
            if v_strip.startswith("[") and v_strip.endswith("]"):
                import json
                try:
                    parsed = json.loads(v_strip)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [i.strip() for i in v_strip.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
