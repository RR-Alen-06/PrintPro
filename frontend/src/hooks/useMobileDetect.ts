import { useState, useEffect } from 'react'

const STORAGE_KEY = 'printpro_viewport_pref'

export function useMobileDetect() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  const [userPref, setUserPrefState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null // 'mobile' | 'desktop' | null
    } catch {
      return null
    }
  })

  // User-Agent detection for mobile devices (iOS, Android, Mobile Safari, Chrome Mobile, Touch)
  const isUserAgentMobile = typeof navigator !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '') ||
    (typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 1024)
  )

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
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

  // Threshold: any device with a mobile/tablet user agent OR viewport < 1024px is considered mobile
  const isMobileDevice = isUserAgentMobile || windowWidth < 1024

  // Effective mode decision:
  // 1. If user explicitly chose 'desktop', force desktop mode regardless of width/userAgent.
  // 2. If user explicitly chose 'mobile', force mobile mode regardless of width/userAgent.
  // 3. Otherwise (first-ever visit / no pref): if isMobileDevice (phones + tablets < 1024px) -> 'mobile'; else 'desktop'.
  let effectiveMode: 'desktop' | 'mobile' = 'desktop'
  if (userPref === 'desktop') {
    effectiveMode = 'desktop'
  } else if (userPref === 'mobile') {
    effectiveMode = 'mobile'
  } else if (isMobileDevice) {
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
