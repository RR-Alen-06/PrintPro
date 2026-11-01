import axios from 'axios'
import { supabase } from '../lib/supabase'

// Dynamically choose base URL: Use relative path in production, and env configuration in local development
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const baseURL = isLocal ? (import.meta.env.VITE_API_BASE_URL || '/api') : '/api';

const api = axios.create({
  baseURL,
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
      console.error('Failed to attach JWT token:', err)
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errorData = error.response?.data;
    let message = errorData?.error || errorData?.message || error.message || 'Something went wrong';

    // If backend provided a tracking reference code, append it to the client message
    if (errorData?.reference) {
      const refSuffix = ` (Ref: ${errorData.reference})`;
      if (!message.includes(errorData.reference)) {
        message = `${message}${refSuffix}`;
      }
      if (errorData.error && !errorData.error.includes(errorData.reference)) {
        errorData.error = `${errorData.error}${refSuffix}`;
      }
    }

    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status,
      message,
      reference: errorData?.reference || undefined,
      data: errorData
    });
    return Promise.reject(error);
  }
);

export default api
