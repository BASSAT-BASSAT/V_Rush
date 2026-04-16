import { useContext } from 'react'
import { ThemeContext } from '../contexts/theme-context'
import type { ThemeContextValue, ThemeMode } from '../contexts/theme-types'

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export type { ThemeMode }
