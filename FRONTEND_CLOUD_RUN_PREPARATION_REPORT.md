# CareBridge AI — Google Cloud Run Frontend Deployment Preparation Report

**Date & Time:** November 15, 2026 | 15:20 IST  
**Target Repository:** [https://github.com/Roheithr07/carebridge-ai](https://github.com/Roheithr07/carebridge-ai)  
**Branch:** `main`  
**Backend API Target:** `https://carebridgeai-20235025853.asia-south1.run.app`  
**Google Cloud Region:** `asia-south1`  
**Status:** **READY FOR CLOUD RUN DEPLOYMENT (NO DEPLOYMENT EXECUTED)**

---

## 1. Files Created & Modified

| File | Status | Description |
|---|---|---|
| [frontend/Dockerfile](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/frontend/Dockerfile) | **Created / Updated** | Multi-stage build (`node:20-alpine` -> `nginx:alpine`). Accepts `ARG VITE_API_URL`, builds production `dist/` with `npm ci` & `npm run build`, and serves assets via Nginx on port 8080. |
| [frontend/nginx.conf](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/frontend/nginx.conf) | **Created / Updated** | Listens on port 8080. Includes gzip compression, `/health` endpoint returning HTTP 200, 1-year immutable caching for hashed assets, and SPA fallback (`try_files $uri $uri/ /index.html;`) with `no-cache` for `index.html`. |
| [frontend/cloudbuild.yaml](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/frontend/cloudbuild.yaml) | **Created** | Dedicated Cloud Build pipeline targeting `asia-south1` Artifact Registry, building Docker image with `_VITE_API_URL` substitution and pushing to `asia-south1-docker.pkg.dev/$PROJECT_ID/$_REPOSITORY/carebridge-frontend`. |
| [cloudbuild-frontend.yaml](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/cloudbuild-frontend.yaml) | **Created** | Root-level Cloud Build configuration enabling building the frontend container directly from the root repository workspace. |
| [frontend/src/services/client.ts](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/frontend/src/services/client.ts) | **Updated** | Enhanced `resolveApiBaseUrl()` to default to `https://carebridgeai-20235025853.asia-south1.run.app` in production builds, enforce single `/api` prefix without duplicate `/api/api`, and avoid localhost in production. |
| [frontend/.env.example](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/frontend/.env.example) | **Updated** | Documented production Cloud Run backend URL (`https://carebridgeai-20235025853.asia-south1.run.app`). |
| [frontend/.dockerignore](file:///C:/Users/91720/.gemini/antigravity/scratch/carebridge-ai/frontend/.dockerignore) | **Verified** | Excludes `node_modules/`, `dist/`, `.env*`, `.git/`, and log files from container build context. |

---

## 2. Docker & Nginx Build Configuration

### 2.1 Multi-Stage Dockerfile (`frontend/Dockerfile`)
```dockerfile
# Stage 1: Build the React + TypeScript + Vite application
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build-time argument for production backend URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve production bundle with Nginx on port 8080
FROM nginx:alpine
RUN rm -rf /etc/nginx/conf.d/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### 2.2 Nginx SPA & Health Configuration (`frontend/nginx.conf`)
```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json image/svg+xml;

    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "healthy\n";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

---

## 3. Backend API URL Resolution

In `frontend/src/services/client.ts`, `resolveApiBaseUrl()` ensures:
1. **Production Backend Priority:** Reads `import.meta.env.VITE_API_URL`, falling back to `https://carebridgeai-20235025853.asia-south1.run.app` when compiled in production mode.
2. **Path Deduplication:** Normalizes trailing slashes and checks `.endsWith('/api')` before appending `/api`, guaranteeing endpoints (`/auth/login`, `/medications`, `/ai-summary`) never produce duplicate `/api/api` paths.
3. **No Localhost in Cloud:** Localhost substitution logic is constrained strictly to `window.location.hostname === 'localhost'`, ensuring Cloud Run browser sessions route to the live Cloud Run backend.

---

## 4. Frontend Compilation & Bundle Verification

- **Command:** `npm run build` (`tsc -b && vite build`)
- **Compilation Time:** 4.76s
- **TypeScript Errors:** 0
- **Vite Bundler Errors:** 0
- **Bundle Verification:**
  - `dist/index.html`: 1.11 kB (gzip: 0.68 kB)
  - `dist/assets/index-O1YSvQh4.css`: 43.45 kB (gzip: 8.05 kB)
  - `dist/assets/index-Cz7J72HO.js`: 929.75 kB (gzip: 259.74 kB)
  - String search confirmed `https://carebridgeai-20235025853.asia-south1.run.app` embedded inside the compiled JavaScript bundle.
- **Secrets Audit:** Verified 0 occurrences of `GROQ_API_KEY`, `gsk_`, or backend database credentials in frontend assets.

---

## 5. Google Cloud Build Deployment Instructions

### 5.1 Prerequisites in `asia-south1`
```bash
export PROJECT_ID=$(gcloud config get-value project)
export REGION="asia-south1"

# Ensure Artifact Registry repository exists in asia-south1
gcloud artifacts repositories create carebridge-repo \
    --repository-format=docker \
    --location=${REGION} \
    --description="CareBridge AI Docker Repository" || true
```

### 5.2 Build & Push Frontend Image via Cloud Build

#### Option A: Submit from the Repository Root
```bash
gcloud builds submit \
    --config=cloudbuild-frontend.yaml \
    --substitutions=_REGION="asia-south1",_REPOSITORY="carebridge-repo",_VITE_API_URL="https://carebridgeai-20235025853.asia-south1.run.app" \
    .
```

#### Option B: Submit from the `frontend/` Subdirectory
```bash
cd frontend
gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions=_REGION="asia-south1",_REPOSITORY="carebridge-repo",_VITE_API_URL="https://carebridgeai-20235025853.asia-south1.run.app" \
    .
```

### 5.3 Deploy Frontend Service to Cloud Run
```bash
gcloud run deploy carebridge-frontend \
    --image=asia-south1-docker.pkg.dev/${PROJECT_ID}/carebridge-repo/carebridge-frontend:latest \
    --region=asia-south1 \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=256Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10
```

### 5.4 Update Backend CORS Configuration
Once the frontend service is deployed and its URL is assigned (e.g. `https://carebridge-frontend-20235025853.asia-south1.run.app`):
```bash
export FRONTEND_URL=$(gcloud run services describe carebridge-frontend --region=asia-south1 --format='value(status.url)')

# Authorize frontend origin in backend CORS
gcloud run services update carebridgeai \
    --region=asia-south1 \
    --update-env-vars="CORS_ORIGINS=${FRONTEND_URL}"
```

---

## 6. Blockers

- **None.** All configurations, build artifacts, scripts, and documentation are verified and ready.
