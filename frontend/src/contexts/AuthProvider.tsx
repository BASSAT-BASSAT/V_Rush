import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const bypass = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
    return url.length === 0
  }, [])

  const [session, setSession] = useState<AuthContextValue['session']>(null)
  const [loading, setLoading] = useState(() => {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
    return url.length > 0
  })

  useEffect(() => {
    if (bypass) return

    const sb = getSupabase()
    void sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [bypass])

  const signOut = async () => {
    if (bypass) return
    await getSupabase().auth.signOut()
  }

  const value: AuthContextValue = {
    session,
    loading,
    bypass,
    accessToken: session?.access_token ?? null,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
