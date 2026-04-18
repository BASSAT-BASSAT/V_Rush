import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface Props {
  children: ReactNode
}

/** Gate a route behind Supabase auth. Honors the KERNELLAB_AUTH_DISABLED bypass. */
export function RequireAuth({ children }: Props) {
  const { loading, session, bypass } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="app__loading" role="status">
        Loading…
      </div>
    )
  }

  if (!bypass && !session) {
    const next = location.pathname + location.search
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
