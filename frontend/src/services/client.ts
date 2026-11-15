import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Resolve API base URL dynamically to handle 127.0.0.1 vs localhost gracefully
function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  let base = envUrl || 'http://127.0.0.1:8000';

  // If user accesses via localhost, ensure requests also route through localhost to avoid cross-origin cookie/port issues
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

