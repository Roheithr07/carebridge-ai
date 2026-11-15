import logging
import threading
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import (
    auth, dashboard, medications, medication_logs,
    appointments, family_access, notifications, activity, ai_summary
)
from app.seed_data import seed_demo_database
from app.services.reminder_engine import check_and_process_reminders

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("carebridge")

_scheduler_running = True

def background_reminder_worker():
    """Background worker that runs every 60 seconds to process reminders and overdue checks."""
    logger.info("CareBridge AI Smart Reminder Engine background worker initiated.")
    while _scheduler_running:
        try:
            with SessionLocal() as db:
                check_and_process_reminders(db)
        except Exception as e:
            logger.error(f"Error in background reminder worker: {e}")
        time.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist & seed demo data
    logger.info("Initializing CareBridge AI database tables...")
    Base.metadata.create_all(bind=engine)
    try:
        seed_demo_database()
    except Exception as e:
        logger.error(f"Error during seed: {e}")

    # Start background reminder worker thread
    global _scheduler_running
    _scheduler_running = True
    worker_thread = threading.Thread(target=background_reminder_worker, daemon=True)
    worker_thread.start()

    yield

    # Shutdown
    _scheduler_running = False
    logger.info("Shutting down CareBridge AI backend service.")


app = FastAPI(
    title="CareBridge AI API",
    description="Smarter Care. Safer Living. Connected Families. Healthcare & Medication Management Platform for Catalyst Hackathon 2026.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration - supports development ports and production domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(medications.router, prefix=settings.API_V1_STR)
app.include_router(medication_logs.router, prefix=settings.API_V1_STR)
app.include_router(appointments.router, prefix=settings.API_V1_STR)
app.include_router(family_access.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(activity.router, prefix=settings.API_V1_STR)
app.include_router(ai_summary.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "app": "CareBridge AI Platform",
        "tagline": "Smarter Care. Safer Living. Connected Families.",
        "status": "healthy",
        "api_docs": "/docs",
        "version": "1.0.0",
        "hackathon": "Catalyst Hackathon 2026"
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "carebridge-backend"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."}
    )

