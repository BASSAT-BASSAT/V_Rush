import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  loading: boolean
  bypass: boolean
  accessToken: string | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
