# CareBridge AI — Google Cloud Run Production Deployment Guide

This guide details the step-by-step production preparation, containerization, and deployment of the CareBridge AI full-stack application (FastAPI backend and React Vite SPA frontend) to **Google Cloud Run**, integrated with **Google Cloud SQL for PostgreSQL** and **Google Secret Manager**.

---

## 1. Architecture Overview on Google Cloud

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │                     END USER                           │
                                    │      (Web Browser / Mobile Senior Mode)                │
                                    └───────────────────┬────────────────────────────────────┘
                                                        │
                              ┌─────────────────────────┴────────────────────────┐
                              │ HTTPS (Port 443)                                 │
                              ▼                                                  ▼
             ┌─────────────────────────────────┐              ┌─────────────────────────────────────┐
             │       Cloud Run: Frontend       │              │         Cloud Run: Backend          │
             │   Container: Nginx Alpine       │              │    Container: Python 3.11 Slim      │
             │   Listens on: $PORT (8080)      │              │    Listens on: $PORT (8080)         │
             │   SPA Routing: /index.html      │              │    ASGI: Uvicorn (app.main:app)     │
             └─────────────────────────────────┘              └──────────────────┬──────────────────┘
                                                                                 │
                                               ┌─────────────────────────────────┼──────────────────────────────┐
                                               │ Cloud SQL Unix Socket / VPC     │ Secret Manager               │ Groq Cloud API
                                               ▼                                 ▼                              ▼
                               ┌───────────────────────────────┐ ┌───────────────────────────┐  ┌───────────────────────────┐
                               │     Cloud SQL PostgreSQL      │ │   Google Secret Manager   │  │        Groq Cloud         │
                               │  - Persistent Patient Data    │ │  - GROQ_API_KEY           │  │  Model: openai/gpt-oss-120b│
                               │  - Adherence Logs & Doses     │ │  - SECRET_KEY             │  │  Clinical Summaries (JSON)│
                               │  - Appointments & Audit Logs  │ │  - DB_PASSWORD            │  │  Strict Non-Diagnostic    │
                               └───────────────────────────────┘ └───────────────────────────┘  └───────────────────────────┘
```

---

## 2. Prerequisites & GCP Setup

Ensure you have the following before beginning:
1. **Google Cloud SDK (`gcloud` CLI)** installed and authenticated.
2. A GCP project created with billing enabled.
3. Appropriate IAM roles: `Cloud Run Admin`, `Cloud Build Editor`, `Secret Manager Admin`, `Cloud SQL Admin`.

```bash
# Set your active project and default region
gcloud config set project YOUR_PROJECT_ID
export PROJECT_ID=$(gcloud config get-value project)
export REGION="us-central1"

# Enable required Google Cloud APIs
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    sqladmin.googleapis.com
```

### Artifact Registry Docker Repository Setup

Create a Docker repository in Google Artifact Registry to store your container images:

```bash
gcloud artifacts repositories create carebridge-repo \
    --repository-format=docker \
    --location=${REGION} \
    --description="Docker repository for CareBridge AI images"
```

---

## 3. Persistent Database: Cloud SQL (PostgreSQL)

> [!CRITICAL]
> **Cloud Run Container Filesystem is Ephemeral:**  
> Cloud Run instances scale down to zero and execute on an in-memory/scratch filesystem. Storing `carebridge.db` inside the container will result in data loss whenever instances cycle. Production deployments must use **Google Cloud SQL for PostgreSQL**.

### 3.1 Provision Cloud SQL Instance

```bash
# Create Cloud SQL PostgreSQL instance (PostgreSQL 15, minimum 1 vCPU for dev/demo)
gcloud sql instances create carebridge-pg \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=${REGION} \
    --root-password="REPLACE_WITH_STRONG_ROOT_PASSWORD"

# Create application database
gcloud sql databases create carebridge --instance=carebridge-pg

# Create dedicated application user
gcloud sql users create carebridge_user \
    --instance=carebridge-pg \
    --password="REPLACE_WITH_STRONG_APP_PASSWORD"
```

Retrieve the instance connection name:
```bash
export INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe carebridge-pg --format='value(connectionName)')
# Format: YOUR_PROJECT_ID:REGION:carebridge-pg
```

### 3.2 Database URL Format for Cloud Run
When connecting via the Cloud SQL Unix socket mounted automatically by Cloud Run:
```
postgresql+psycopg2://carebridge_user:<PASSWORD>@/carebridge?host=/cloudsql/YOUR_PROJECT_ID:REGION:carebridge-pg
```

---

## 4. Google Secret Manager Setup

Store sensitive credentials in Secret Manager rather than raw environment variables:

```bash
# 1. Groq API Key
echo -n "gsk_your_actual_groq_api_key_here" | \
    gcloud secrets create groq-api-key --data-file=-

# 2. JWT Secret Key (generate 64-character hex string)
python -c "import secrets; print(secrets.token_hex(32), end='')" | \
    gcloud secrets create jwt-secret-key --data-file=-

# 3. Database Password
echo -n "REPLACE_WITH_STRONG_APP_PASSWORD" | \
    gcloud secrets create db-password --data-file=-
```

Grant the Cloud Run default service account permission to read these secrets:
```bash
export PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding groq-api-key \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret-key \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding db-password \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

---

## 5. Backend Build & Deployment (Cloud Run)

### 5.1 Backend Dockerfile Features
- **Base Image:** `python:3.11-slim` (lightweight, secure).
- **Driver:** Includes `psycopg2-binary` for Cloud SQL PostgreSQL connection pooling.
- **Port:** Dynamically binds to `0.0.0.0:${PORT:-8080}`.
- **Health Check:** Exposes `/health` returning `{"status": "ok", "service": "carebridge-backend"}`.
- **Entry Point:** `app.main:app` via Uvicorn with graceful `SIGTERM` process execution.

### 5.2 Build Backend Image with Cloud Build

```bash
# Build from the backend directory
cd backend

gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-backend:latest .
```

### 5.3 Deploy Backend to Cloud Run

```bash
gcloud run deploy carebridge-backend \
    --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-backend:latest \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --add-cloudsql-instances=${INSTANCE_CONNECTION_NAME} \
    --set-env-vars="ENVIRONMENT=production,PROJECT_NAME=CareBridge AI,API_V1_STR=/api,AUTO_SEED_DEMO_DATA=false,DATABASE_URL=postgresql+psycopg2://carebridge_user:REPLACE_WITH_STRONG_APP_PASSWORD@/carebridge?host=/cloudsql/${INSTANCE_CONNECTION_NAME},AI_PROVIDER=groq,GROQ_MODEL=openai/gpt-oss-120b" \
    --set-secrets="GROQ_API_KEY=groq-api-key:latest,SECRET_KEY=jwt-secret-key:latest"
```

Capture the deployed Backend Service URL:
```bash
export BACKEND_URL=$(gcloud run services describe carebridge-backend --region=${REGION} --format='value(status.url)')
echo "Backend deployed at: ${BACKEND_URL}"
```

---

## 6. Frontend Build & Deployment (Cloud Run)

### 6.1 Frontend Dockerfile Features
- **Multi-Stage Build:** Stage 1 compiles React 18, TypeScript 5, Vite into `dist/`. Stage 2 serves assets with Nginx Alpine.
- **Build Argument (`VITE_API_URL`):** Embeds the backend API URL into frontend production assets during build.
- **SPA Routing (`nginx.conf`):** All unknown paths route to `/index.html` via `try_files $uri $uri/ /index.html;` so page reloads on `/appointments`, `/dashboard/elder`, etc., work seamlessly.
- **Port:** Nginx listens on `8080`.
- **Health Check:** Dedicated `location = /health` returning `200 "healthy\n"`.

### 6.2 Build Frontend Image with Cloud Build

```bash
cd ../frontend

# Build frontend passing the BACKEND_URL as build argument
gcloud builds submit \
    --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-frontend:latest \
    --substitutions=_VITE_API_URL="${BACKEND_URL}" \
    .
```

> [!NOTE]
> If using `gcloud builds submit` with build args, create a `cloudbuild.yaml` or use Docker CLI:
> ```bash
> docker build --build-arg VITE_API_URL="${BACKEND_URL}" -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-frontend:latest .
> docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-frontend:latest
> ```

### 6.3 Deploy Frontend to Cloud Run

```bash
gcloud run deploy carebridge-frontend \
    --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-frontend:latest \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=256Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10
```

Capture the deployed Frontend Service URL:
```bash
export FRONTEND_URL=$(gcloud run services describe carebridge-frontend --region=${REGION} --format='value(status.url)')
echo "Frontend deployed at: ${FRONTEND_URL}"
```

---

## 7. Finalizing Production CORS Configuration

Once the frontend URL is established, update the backend service to authorize the exact frontend origin:

```bash
# Update backend CORS_ORIGINS to allow the deployed frontend URL
gcloud run services update carebridge-backend \
    --region=${REGION} \
    --update-env-vars="CORS_ORIGINS=${FRONTEND_URL}"
```

The backend's `CORS_ORIGINS` validator accepts:
- Single URL: `https://carebridge-frontend-xyz-uc.a.run.app`
- Comma-separated URLs: `https://carebridge-frontend-xyz-uc.a.run.app,https://carebridge.myhospital.org`
- JSON array: `["https://carebridge-frontend-xyz-uc.a.run.app"]`

In `ENVIRONMENT=production`, the localhost regex fallback is disabled to enforce strict cross-origin isolation.

---

## 8. Environment Variables Reference

### Backend Service (`carebridge-backend`)

| Variable | Required | Default / Example | Source | Purpose |
|---|---|---|---|---|
| `ENVIRONMENT` | Yes | `production` | Env Var | Disables local dev CORS regex and enables production error handling |
| `PORT` | Yes (Cloud Run) | `8080` | Cloud Run | Target listen port |
| `DATABASE_URL` | Yes | `postgresql+psycopg2://...` | Env Var | Cloud SQL PostgreSQL connection string |
| `SECRET_KEY` | Yes | 64-char random hex string | Secret Manager | HMAC key for signing JWT authentication tokens |
| `GROQ_API_KEY` | Yes | `gsk_...` | Secret Manager | Groq Cloud API authentication key |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Env Var | Groq LLM model name |
| `AI_PROVIDER` | No | `groq` | Env Var | AI backend provider selector |
| `CORS_ORIGINS` | Yes | `${FRONTEND_URL}` | Env Var | Allowed origins for cross-origin browser requests |
| `AUTO_SEED_DEMO_DATA` | No | `false` | Env Var | Set `true` if you want demo accounts automatically created |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` (24h) | Env Var | Token session validity |
| `ENABLE_EMAIL_ALERTS` | No | `false` | Env Var | Set `true` to enable real SMTP dispatch |
| `SMTP_HOST` / `SMTP_PORT` | If email enabled | `smtp.sendgrid.net` / `587` | Env Var | SMTP credentials for missed-dose notifications |

### Frontend Service (`carebridge-frontend`)

| Variable / Arg | Required | Stage | Example | Purpose |
|---|---|---|---|---|
| `VITE_API_URL` | Yes | Docker Build (`ARG`) | `https://carebridge-backend-xyz.a.run.app` | Base REST API target used by Axios client |
| `PORT` | No | Cloud Run Runtime | `8080` | Nginx listen port |

---

## 9. Health Checks & Verification

### 9.1 Backend Probes
- **Liveness & Startup Probe:** `GET /health`  
  Returns: `{"status": "ok", "service": "carebridge-backend"}`
- **Application Info Probe:** `GET /`  
  Returns:
  ```json
  {
    "app": "CareBridge AI Platform",
    "tagline": "Smarter Care. Safer Living. Connected Families.",
    "status": "healthy",
    "api_docs": "/docs",
    "version": "1.0.0",
    "hackathon": "Catalyst Hackathon 2026"
  }
  ```
- **Interactive OpenAPI Documentation:** `GET /docs` and `GET /redoc`

### 9.2 Frontend Probes
- **Nginx Liveness Probe:** `GET /health`  
  Returns: `200 "healthy\n"`
- **SPA Route Test:** `GET /appointments` or `GET /dashboard/elder`  
  Returns: `200` with `index.html` (verifying SPA fallback).

---

## 10. Live End-to-End Testing & Smoke Verification

After deployment, perform these verification checks in order:

```bash
# 1. Test Backend Health
curl -s -i "${BACKEND_URL}/health"
# Expected HTTP 200 OK with {"status": "ok", "service": "carebridge-backend"}

# 2. Test CORS Preflight from Deployed Frontend
curl -s -I -X OPTIONS "${BACKEND_URL}/api/auth/login" \
    -H "Origin: ${FRONTEND_URL}" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization"
# Verify response headers contain:
# access-control-allow-origin: <FRONTEND_URL>
# access-control-allow-credentials: true

# 3. Test Frontend Health
curl -s -i "${FRONTEND_URL}/health"
# Expected HTTP 200 OK with healthy

# 4. Open Frontend Application in Browser
echo "Open in your browser: ${FRONTEND_URL}"
```

### Browser Verification Steps
1. Navigate to `${FRONTEND_URL}`.
2. Verify the landing page loads with zero console errors.
3. Test authentication:
   - If `AUTO_SEED_DEMO_DATA=true` was set, log in with `eleanor@carebridge.com` / `Password123!`.
   - Or register a new account on `/register`.
4. Verify Senior Mode toggle enlarges touch targets and typography.
5. Generate an AI Clinical Summary on `/ai-summary` to confirm backend Groq communication.
6. Refresh the page while on `/appointments` to confirm Nginx SPA fallback routing functions without 404s.

---

## 11. Rollback & Maintenance

### Roll Back to Previous Revision
```bash
# List revisions
gcloud run revisions list --service=carebridge-backend --region=${REGION}

# Direct 100% traffic to previous stable revision
gcloud run services update-traffic carebridge-backend \
    --region=${REGION} \
    --to-revisions=REVISION_NAME=100
```

