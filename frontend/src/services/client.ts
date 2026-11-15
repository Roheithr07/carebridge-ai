import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Resolve API base URL dynamically:
// - Uses VITE_API_URL if provided at build or runtime
// - Defaults to the deployed Cloud Run backend in production
// - Defaults to http://127.0.0.1:8000 in local development
// - Normalizes trailing slashes and guarantees a single /api prefix without /api/api duplication
function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  let base = envUrl;

  if (!base || base.trim() === '') {
    base = import.meta.env.PROD
      ? 'https://carebridgeai-20235025853.asia-south1.run.app'
      : 'http://127.0.0.1:8000';
  }

  // If running locally in browser dev, ensure requests route through localhost to avoid cross-origin cookie issues
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && base.includes('127.0.0.1')) {
    base = base.replace('127.0.0.1', 'localhost');
  }

  const clean = base.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('carebridge_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Global 401 expiration handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const isPublicPath = 
        window.location.pathname === '/' || 
        window.location.pathname === '/login' || 
        window.location.pathname === '/register';

      if (!isPublicPath) {
        localStorage.removeItem('carebridge_token');
        localStorage.removeItem('carebridge_user');
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);
