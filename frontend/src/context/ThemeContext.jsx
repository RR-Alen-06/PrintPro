import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
})

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('printpro-theme') || 'light'
    } catch {
      return 'light'
    }
  })

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme || 'light'
  })

  useEffect(() => {
    const updateTheme = () => {
      let activeTheme = theme
      if (theme === 'system') {
        activeTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      setResolvedTheme(activeTheme)
      document.documentElement.setAttribute('data-theme', activeTheme)
      try {
        localStorage.setItem('printpro-theme', theme)
      } catch {
        // ignore localStorage errors
      }
    }

    updateTheme()

    if (theme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => updateTheme()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState((prev) => {
      const currentResolved = prev === 'system'
        ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : prev
      return currentResolved === 'dark' ? 'light' : 'dark'
    })
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
