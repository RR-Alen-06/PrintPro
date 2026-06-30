import axios from 'axios'
import { supabase } from '../lib/supabase'

// Dynamically choose base URL: Use VITE_API_BASE_URL if defined and valid, otherwise relative path in production
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname === '[::1]'
);

const getBaseURL = () => {
  if (isLocal) {
    return 'http://localhost:5000/api';
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl !== 'http://localhost:5000/api') {
    return envUrl;
  }
  return '/api';
};

const baseURL = getBaseURL();

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
    const requestConfig = error.config;
    const response = error.response;
    
    console.error('=== SYNCHRONIZATION FAILED ===');
    console.error(`Request URL:    ${requestConfig?.method?.toUpperCase()} ${requestConfig?.baseURL || ''}${requestConfig?.url || ''}`);
    console.error(`Request Data:   `, requestConfig?.data ? (typeof requestConfig.data === 'string' ? JSON.parse(requestConfig.data) : requestConfig.data) : 'None');
    
    if (response) {
      console.error(`Response Code:  ${response.status}`);
      console.error(`Response Body:  `, response.data);
      console.error(`Response Headers:`, response.headers);
    } else {
      console.error(`No response received from server. Network error: ${error.message}`);
    }
    console.error('==============================');
    
    const message = response?.data?.error || error.message || 'Something went wrong'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)


export default api
