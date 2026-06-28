import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env variables to print them in build logs
  const env = loadEnv(mode, process.cwd(), '')
  console.log('=== VITE BUILD-TIME ENVIRONMENT VARIABLES ===')
  console.log('Available VITE_ keys:', Object.keys(env).filter(k => k.startsWith('VITE_')))
  console.log('VITE_SUPABASE_URL length:', env.VITE_SUPABASE_URL ? env.VITE_SUPABASE_URL.length : 0)
  console.log('VITE_SUPABASE_ANON_KEY length:', env.VITE_SUPABASE_ANON_KEY ? env.VITE_SUPABASE_ANON_KEY.length : 0)
  console.log('============================================')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  }
})
