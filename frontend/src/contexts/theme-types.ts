export type ThemeMode = 'dark' | 'light'

export interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  toggle: () => void
}
