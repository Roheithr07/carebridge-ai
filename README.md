# CareBridge AI

> **Smarter Care. Safer Living. Connected Families.**  
> *Comprehensive Elderly Care, Medication Adherence & Multi-Role Coordination Platform*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Groq AI](https://img.shields.io/badge/Groq_AI-Llama3_&_OSS-orange.svg?logo=groq&logoColor=white)](https://groq.com)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00.svg?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org)
[![Pytest](https://img.shields.io/badge/Pytest-22_Passing_(100%25)-brightgreen.svg?logo=pytest&logoColor=white)](https://pytest.org)

---

## 1. Executive Summary & Problem Statement

Elderly individuals frequently balance complex daily medication regimens, recurring doctor visits, and dietary restrictions. When family members or professional caregivers are physically distant or unavailable, missed doses, schedule confusion, and poor communication lead to preventable hospitalizations and deteriorating health.

Traditional reminder apps suffer from three fatal flaws:
1. **Isolated experiences:** The senior is left on an island without transparent, real-time family or caregiver oversight.
2. **Loss of agency:** The senior feels stripped of autonomy and dignity by third-party tracking apps.
3. **Fragile reminders & naive metrics:** Simple browser-tab timers fail when tabs close, and standard adherence metrics naively penalize seniors for upcoming future doses.

### The CareBridge AI Solution
**CareBridge AI** establishes an interconnected, safe, and transparent healthcare circle around the senior:
- **Elder-Centered Sovereignty:** Seniors generate a private 6-digit passcode (e.g. `CB-849201`) to authorize family members and caregivers, with instant 1-click access revocation.
- **Smart Background Reminder Daemon:** An autonomous background engine continuously monitors scheduled times, detects unconfirmed doses beyond a configurable grace period, logs missed doses without duplicates, and triggers in-app and email alerts.
- **Accurate Adherence Mathematics:** Calculates adherence strictly from past scheduled doses:
  $$\text{Adherence Rate} = \left(\frac{\text{Taken Doses}}{\text{Total Scheduled Due Doses}}\right) \times 100$$
  *(Future doses are strictly excluded from the calculation).*
- **Universal Accessibility:** Features an instant **Senior Mode** toggle (elevating base font size to 18px and enlarging touch targets to 48px+) and an **Evaluation Bar** offering 1-click persona switching for evaluators.
- **Groq AI Clinical Summaries:** Synthesizes weekly adherence metrics, highlights missed doses, and drafts structured doctor visit preparation notes with strict non-diagnostic safety guardrails.

---

## 2. System Architecture

```
                    ┌────────────────────────────────────────┐
                    │          CAREBRIDGE AI WEB APP         │
                    │   React 18 • TypeScript • Tailwind CSS │
                    │      Recharts • Framer Motion • Lucide │
                    └───────────────────┬────────────────────┘
                                        │ REST API (JWT Bearer)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │          FASTAPI BACKEND CORE          │
                    │   Pydantic V2 • Argon2id / PyJWT       │
                    │    SQLAlchemy 2.0 ORM • SQLite / PG    │
                    │      Groq AI Clinical Assistant        │
                    └───────┬───────────────┬────────────────┘
                            │               │
            ┌───────────────▼──────┐ ┌──────▼────────────────────────┐
            │  SQLAlchemy Database │ │  Background Reminder Worker   │
            │  - users             │ │  - Overdue grace period scan  │
            │  - elderly_profiles  │ │  - Upcoming dose alerts       │
            │  - medications       │ │  - Appointment advance warning│
            │  - schedules         │ │  - Duplicate notification guard│
            │  - medication_logs   │ │  - In-app & SMTP email alert  │
            │  - appointments      │ └───────────────────────────────┘
            │  - patient_access    │
            │  - notifications     │
            │  - activity_logs     │
            └──────────────────────┘
```

---

## 3. Repository & Folder Structure

CareBridge AI is structured as a unified monorepo containing both the backend and frontend applications:

```
carebridge-ai/
├── backend/
│   ├── app/
│   │   ├── api/                 # API routers (auth, elderly, medications, appointments, etc.)
│   │   ├── core/                # Configuration, security, database session setup
│   │   ├── models/              # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/             # Pydantic schemas for request validation & serialization
│   │   ├── services/            # Reminder engine, Groq AI service, email alerts
│   │   ├── main.py              # FastAPI application entry point
│   │   └── seed_data.py         # Realistic demo seed data generator
│   ├── tests/                   # 22 automated Pytest test suites
│   ├── .env.example             # Backend environment template
│   ├── requirements.txt         # Python dependencies
│   └── render.yaml              # Render deployment blueprint
├── frontend/
│   ├── public/                  # Favicons and static assets
│   ├── src/
│   │   ├── assets/              # Static media
│   │   ├── components/          # Reusable UI components (Senior Mode, Navbar, Modals)
│   │   ├── context/             # AuthContext, ThemeContext, AccessibilityContext
│   │   ├── layouts/             # Dashboard and auth layout wrappers
│   │   ├── pages/               # ElderDashboard, FamilyDashboard, CaregiverDashboard, etc.
│   │   ├── services/            # Axios API client services (auth, meds, AI summaries)
│   │   ├── types/               # TypeScript interfaces and domain models
│   │   ├── App.tsx              # Application route tree
│   │   └── main.tsx             # React DOM root entry
│   ├── .env.example             # Frontend environment template
│   ├── package.json             # Node dependencies and scripts
│   ├── tsconfig.json            # TypeScript configuration
│   └── vite.config.ts           # Vite build configuration
├── .gitignore                   # Unified Git ignore rules
└── README.md                    # Project documentation
```

---

## 4. Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript & Vite
- **Styling:** Tailwind CSS (Deep Navy `#14243A`, Soft Teal `#20B8A5`, Light Neutral `#F7F9FC`)
- **Navigation:** React Router 6 (SPA with protected role routing)
- **Visualizations:** Recharts (responsive daily dose breakdown bar charts & 14-day adherence trend lines)
- **UI Components & Icons:** Lucide React Icons
- **Notifications:** React Hot Toast
- **API Client:** Axios with JWT request interceptors & 401 token refresh handling

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **ORM & Database:** SQLAlchemy 2.0 with SQLite (development) and PostgreSQL readiness
- **Data Validation:** Pydantic V2 schemas with `model_config = ConfigDict(from_attributes=True)`
- **Authentication:** JWT Bearer tokens with Argon2id password hashing (OWASP standard)
- **Background Daemon:** Threaded multi-tier reminder engine executing automated overdue scans
- **AI Analytics:** Official Groq API integration (`openai/gpt-oss-120b` or `llama3-70b-8192`) with robust fallback

---

## 5. Core Application Features

### Module 1: Role-Specific Dashboards
- **Elder Dashboard:** High-legibility today's schedule, 1-touch "Take Now" and "Skip" confirmation, live adherence gauge, upcoming appointments, and emergency contacts.
- **Family Dashboard:** Multi-elder monitoring cards, real-time missed-dose alerts banner, connection center, and recent care activity feed.
- **Caregiver Dashboard:** Cross-patient dose verification table, pending administration queue, clinical visit tracker, and patient switcher.

### Module 2: Medication & Schedule Management
- Complete creation, editing, and deletion of medication regimens.
- Configurable multiple daily administration times (Morning `08:00`, Afternoon `13:00`, Evening `19:00`, Bedtime `21:00`).
- Start and end date bounds, dosage quantity, and doctor instructions.

### Module 3: Mathematically Accurate Adherence Tracking
- Records every scheduled dose state (`taken`, `skipped`, `missed`, `pending`).
- Accurately excludes future doses to prevent false adherence penalties.
- Recharts-powered analytics for daily distributions and weekly trend detection (Improving / Declining / Stable).

### Module 4: Doctor Appointments
- Full CRUD for consultations, follow-ups, and lab screenings.
- Advance reminder flags and clinic location details.

### Module 5: Smart Reminder Engine
- Autonomous background worker scanning every 60 seconds.
- Identifies doses pending beyond the configured grace period (30 minutes default) and marks them as missed.
- Triggers alerts for elderly user and authorized family members simultaneously.
- Duplicate notification prevention using database metadata keys.

### Module 6: Passcode-Based Patient Sharing
- Unique 6-digit alphanumeric code generation for elderly profiles.
- 1-click code regeneration / rotation.
- Instant access revocation by the senior immediately terminating third-party access.

### Module 7: AI Healthcare Activity Assistant (Groq)
- Synthesizes adherence history, highlights missed medications, and structures upcoming doctor visit preparations.
- Strictly adheres to clinical safety guardrails: never prescribes, alters doses, or diagnoses.

---

## 6. Preloaded Demo Accounts

CareBridge AI comes pre-seeded with realistic, historical tracking data across 3 interconnected user personas. Evaluators can use the top **Hackathon Evaluation Bar** to switch between personas with 1-click, or log in manually:

| Persona | Name | Role | Email | Password | Preloaded Data |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Elderly Individual** | Eleanor Vance | `elderly` | `eleanor@carebridge.com` | `Password123!` | Passcode `CB-849201`, 4 active medications, 14-day historical dose log, upcoming Cardiology appointment. |
| **Family Member** | Sarah Vance (Daughter) | `family` | `sarah@carebridge.com` | `Password123!` | Actively linked to Eleanor's profile, monitors daily adherence, receives missed-dose alerts. |
| **Caregiver** | Nurse David Miller, RN | `caregiver` | `david@carebridge.com` | `Password123!` | Assigned to Eleanor, administers daily doses across patients, manages clinical notes. |

---

## 7. Environment Configuration

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and configure:
```env
PROJECT_NAME="CareBridge AI"
API_V1_STR="/api"
SECRET_KEY="your-jwt-secret-key-change-in-production"
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALGORITHM="HS256"
DATABASE_URL="sqlite:///./carebridge.db"

# Notification & Reminder Engine
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
EMAILS_FROM_EMAIL="alerts@carebridge-ai.com"
EMAILS_FROM_NAME="CareBridge AI Alerts"
ENABLE_EMAIL_ALERTS=false
GRACE_PERIOD_MINUTES=30

# AI Configuration (Groq API)
GROQ_API_KEY="your-groq-api-key-here"
GROQ_MODEL="openai/gpt-oss-120b"
AI_PROVIDER="groq"

# Application & CORS Settings
CORS_ORIGINS=["http://localhost:5173","http://localhost:5174","http://127.0.0.1:5173","http://localhost:3000"]
```

### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_API_URL=http://127.0.0.1:8000
```

---

## 8. Local Installation & Startup Guide

### Prerequisites
- Python 3.10+ (tested on Python 3.11.9)
- Node.js 18+ (tested on Node v24+)
- npm 9+

### Backend Startup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated tests
pytest -v

# Start FastAPI application
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000).  
Interactive Swagger API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).  
Alternative ReDoc documentation: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc).

### Frontend Startup

```bash
cd frontend

# Install dependencies
npm install

# Build to verify TypeScript and bundle
npm run build

# Start local Vite development server
npm run dev
```

The frontend web app will open at [http://localhost:5173](http://localhost:5173).

---

## 9. Automated Testing Instructions

CareBridge AI features a 22-test automated Pytest suite covering all core and Phase 2 workflows:

```bash
cd backend
python -m pytest tests -v
```

### Test Coverage Highlights
- `tests/test_api.py`: Health checks, authentication for demo personas, elder/family/caregiver dashboard schemas, dose actions, adherence updates, appointments CRUD, and unauthorized access boundary enforcement.
- `tests/test_functional_integration.py`: Argon2id password hashing, medication CRUD lifecycle, passcode sharing and 1-click revocation, and strict exclusion of future scheduled doses from adherence calculations.
- `tests/test_groq_integration.py`: Direct Groq AI synthesis, authenticated AI summary endpoint responses, safe fallback handling on invalid keys, and unauthorized block verification.
- `tests/test_phase2_features.py`: Full appointment fields validation, caregiver passcode collaboration, automated reminder engine scans, and email dispatch templates.

**All 22 tests pass cleanly:**
```
======================= 22 passed, 1 warning in 17.87s ========================
```

---

## 10. Deployment Overview

- **Frontend (Vercel):** The Vite React SPA can be deployed directly on Vercel with the root set to `frontend` and `VITE_API_URL` pointing to the deployed backend API URL.
- **Backend (Render / Railway):** Configured via `render.yaml` or Docker, using `uvicorn app.main:app --host 0.0.0.0 --port $PORT` with PostgreSQL or persistent volume SQLite.

---

## 11. Healthcare Safety & Disclaimer

> [!IMPORTANT]
> **CareBridge AI is a care coordination, reminder, and communication application — NOT a medical diagnosis, prescription, or treatment system.**  
> - CareBridge AI does not provide clinical diagnoses, prescribe medications, or modify dosages.
> - The AI summary features provide organizational synthesis of adherence logs and appointments for communication purposes only.
> - CareBridge AI is an MVP / development demonstration and does not claim production clinical readiness or HIPAA certification.
> - Users and caregivers must always consult licensed healthcare professionals regarding symptoms, prescriptions, and medical decisions.
