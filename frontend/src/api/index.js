import axios from 'axios'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

// Dynamically choose base URL: Use relative path in production, and env configuration in local development
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const baseURL = isLocal ? (import.meta.env.VITE_API_BASE_URL || '/api') : '/api';

// Circuit breaker state for backend availability
let backendStatus = 'unknown'; // 'unknown' | 'available' | 'unavailable'
let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 30000; // Check again after 30s if unavailable

export const checkBackendHealth = async () => {
  try {
    const res = await axios.get(`${baseURL}/health`, { timeout: 400 });
    backendStatus = res.status === 200 ? 'available' : 'unavailable';
  } catch (err) {
    backendStatus = 'unavailable';
  }
  lastCheckTime = Date.now();
  return backendStatus === 'available';
};

export const isBackendAvailable = () => {
  if (backendStatus === 'available') return true;
  if (backendStatus === 'unavailable') {
    // If cooldown passed, allow a background health check without blocking current call
    if (Date.now() - lastCheckTime > CHECK_COOLDOWN_MS) {
      checkBackendHealth();
    }
    return false;
  }
  return true; // 'unknown', allow first attempt
};

export const markBackendUnavailable = () => {
  backendStatus = 'unavailable';
  lastCheckTime = Date.now();
};

export const markBackendAvailable = () => {
  backendStatus = 'available';
  lastCheckTime = Date.now();
};

// Initial background probe on client load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    checkBackendHealth();
  }, 0);
}

const api = axios.create({
  baseURL,
  timeout: 800, // Never hang for more than 800ms on network timeouts
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to attach Supabase JWT dynamically
api.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch (err) {
      logger.error('Failed to attach JWT token:', err)
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => {
    markBackendAvailable();
    return response;
  },
  (error) => {
    // If network error, connection refused, or timeout, mark backend unavailable so subsequent requests fail fast
    if (!error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || (error.response && error.response.status >= 500)) {
      markBackendUnavailable();
    }
    const message = error.response?.data?.error || error.message || 'Something went wrong';
    logger.error('API Error:', message);
    return Promise.reject(error);
  }
)

export default api

