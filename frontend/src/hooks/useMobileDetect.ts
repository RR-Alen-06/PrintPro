import { useState, useEffect } from 'react'

const STORAGE_KEY = 'printpro_viewport_pref'

// User-Agent & touch detection for mobile / tablet devices (iOS, Android, Mobile Safari, Chrome Mobile, Touch) computed once at module level
const isUserAgentMobile = typeof navigator !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '') ||
  (typeof window !== 'undefined' && ('ontouchstart' in window || (Boolean(navigator.maxTouchPoints) && navigator.maxTouchPoints > 0)) && window.innerWidth < 1024)
)

export function useMobileDetect() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  const [userPref, setUserPrefState] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || null
      const initialIsMobile = isUserAgentMobile || (typeof window !== 'undefined' && window.innerWidth < 1024)
      // Auto-clear stale 'desktop' preference if visitor is on a mobile device
      if (initialIsMobile && stored === 'desktop') {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return stored
    } catch {
      return null
    }
  })

  // Threshold: any device with a mobile/tablet user agent OR viewport < 1024px is considered mobile
  const isMobileDevice = isUserAgentMobile || windowWidth < 1024

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      setWindowWidth(width)
      
      const isMobile = isUserAgentMobile || width < 1024
      if (isMobile && localStorage.getItem(STORAGE_KEY) === 'desktop') {
        try {
          localStorage.removeItem(STORAGE_KEY)
          setUserPrefState(null)
        } catch (e) {
          console.warn('Could not clear stale viewport preference', e)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  const setUserPref = (pref: string | null) => {
    try {
      if (pref === null) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, pref)
      }
      setUserPrefState(pref)
    } catch (e) {
      console.warn('Could not save viewport preference to localStorage', e)
    }
  }

  // Effective mode decision:
  // 1. If user explicitly chose 'desktop' and is NOT on a mobile device (< 1024px), force desktop.
  // 2. If user explicitly chose 'mobile', force mobile mode.
  // 3. If on a mobile device (phones + tablets < 1024px) -> 'mobile'.
  // 4. Otherwise -> 'desktop'.
  let effectiveMode: 'desktop' | 'mobile' = 'desktop'
  if (isMobileDevice) {
    effectiveMode = userPref === 'desktop' ? 'desktop' : 'mobile'
  } else if (userPref === 'mobile') {
    effectiveMode = 'mobile'
  } else {
    effectiveMode = 'desktop'
  }

  return {
    windowWidth,
    isMobileDevice,
    isMobile: isMobileDevice,
    userPref,
    effectiveMode,
    setUserPref,
  }
}

