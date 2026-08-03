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

  const setUserPref = (pref) => {
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

  // Thresholds
  const isPhone = windowWidth < 480
  const isTablet = windowWidth >= 480 && windowWidth < 768
  const isMobileViewport = windowWidth < 768

  // Effective mode decision:
  // If user explicitly chose 'desktop', force desktop mode regardless of width.
  // If user explicitly chose 'mobile', force mobile mode regardless of width.
  // Otherwise, auto-switch for phones (<480px), show banner for tablets (480-768px).
  let effectiveMode = 'desktop'
  if (userPref === 'desktop') {
    effectiveMode = 'desktop'
  } else if (userPref === 'mobile') {
    effectiveMode = 'mobile'
  } else if (isPhone) {
    effectiveMode = 'mobile'
  } else {
    effectiveMode = 'desktop'
  }

  return {
    windowWidth,
    isPhone,
    isTablet,
    isMobileViewport,
    userPref,
    effectiveMode,
    setUserPref,
  }
}
