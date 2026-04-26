import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Status = 'working' | 'success' | 'error'

const OTP_TYPES = new Set([
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email',
  'email_change',
])

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return typeof value === 'string' && OTP_TYPES.has(value)
}

function safeNext(raw: string | null): string {
  if (!raw) return '/studio'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/studio'
  return raw
}

function readableError(err: unknown): string {
  if (!err) return 'Something went wrong while finalizing sign-in.'
  if (typeof err === 'string') return err
  const e = err as { message?: string; error_description?: string }
  return e.error_description ?? e.message ?? 'Authentication failed.'
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, bypass } = useAuth()
  const ranRef = useRef(false)

  const [status, setStatus] = useState<Status>('working')
  const [message, setMessage] = useState<string>('Confirming your account…')
  const [flowKind, setFlowKind] = useState<'email' | 'oauth' | 'recovery' | 'generic'>('generic')

  const nextPath = useMemo(() => {
    const search = new URLSearchParams(location.search)
    return safeNext(search.get('next'))
  }, [location.search])

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (bypass) {
      setStatus('success')
      setMessage('Auth is bypassed in this build. You are good to go.')
      return
    }

    const finalize = async () => {
      try {
        const sb = getSupabase()

        const url = new URL(window.location.href)
        const search = url.searchParams
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))

        const errorParam = search.get('error') ?? hash.get('error')
        const errorDescription =
          search.get('error_description') ?? hash.get('error_description')
        if (errorParam) {
          throw new Error(errorDescription || errorParam)
        }

        const code = search.get('code')
        const tokenHash = search.get('token_hash')
        const otpType = search.get('type')
        const provider = search.get('provider') ?? hash.get('provider')

        if (otpType === 'recovery') setFlowKind('recovery')
        else if (provider) setFlowKind('oauth')
        else if (otpType === 'signup' || otpType === 'email' || otpType === 'invite')
          setFlowKind('email')

        let resolved = false

        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(window.location.href)
          if (error) throw error
          resolved = true
        } else if (tokenHash && isEmailOtpType(otpType)) {
          const { error } = await sb.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          })
          if (error) throw error
          resolved = true
          if (otpType === 'signup' || otpType === 'email' || otpType === 'invite') {
            setFlowKind('email')
          }
        } else if (hash.get('access_token')) {
          // Implicit / legacy hash flow — give detectSessionInUrl a beat.
          await new Promise((r) => setTimeout(r, 250))
          const { data, error } = await sb.auth.getSession()
          if (error) throw error
          if (!data.session) throw new Error('No session found in the redirect URL.')
          resolved = true
        } else {
          // No params at all — maybe the SDK already handled it.
          const { data } = await sb.auth.getSession()
          if (data.session) {
            resolved = true
          } else {
            throw new Error(
              'This confirmation link is missing its parameters. Open the most recent email in your inbox and click the link directly (do not copy/paste).',
            )
          }
        }

        if (!resolved) throw new Error('Unable to finish sign-in.')

        // Clean the URL so the one-time code/hash isn't visible or re-used on refresh.
        window.history.replaceState({}, document.title, '/auth/callback')

        setStatus('success')
        if (flowKind === 'oauth' || provider) {
          setMessage('Signed in with Google. Redirecting…')
        } else if (otpType === 'recovery') {
          setMessage('Recovery link verified. Redirecting…')
        } else {
          setMessage('Email confirmed. You are now signed in.')
        }
      } catch (err: unknown) {
        setStatus('error')
        setMessage(readableError(err))
      }
    }

    void finalize()
  }, [bypass, flowKind])

  // Auto-redirect after success. We wait until the AuthProvider has the session so
  // RequireAuth doesn't bounce the user back to /signin.
  useEffect(() => {
    if (status !== 'success') return
    if (!bypass && !session) return
    const id = window.setTimeout(() => {
      navigate(nextPath, { replace: true })
    }, 1500)
    return () => window.clearTimeout(id)
  }, [status, session, bypass, navigate, nextPath])

  return (
    <div className="auth-callback">
      <div className={`auth-callback__card auth-callback__card--${status}`}>
        <p className="auth-callback__eyebrow">V-Rush</p>
        {status === 'working' && (
          <>
            <div className="auth-callback__spinner" aria-hidden />
            <h2 className="auth-callback__title">Finalizing sign-in…</h2>
            <p className="auth-callback__hint">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="auth-callback__check" aria-hidden>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="auth-callback__title">
              {flowKind === 'oauth'
                ? 'Signed in with Google'
                : flowKind === 'recovery'
                  ? 'Link verified'
                  : 'Email confirmed'}
            </h2>
            <p className="auth-callback__hint">{message}</p>
            <button
              type="button"
              className="btn btn--primary auth-callback__cta"
              onClick={() => navigate(nextPath, { replace: true })}
            >
              Continue
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="auth-callback__cross" aria-hidden>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </div>
            <h2 className="auth-callback__title">Could not confirm</h2>
            <p className="auth-callback__error">{message}</p>
            <p className="auth-callback__hint">
              Try signing in again. If the problem keeps happening, request a fresh
              confirmation email from the sign-in page.
            </p>
            <Link to="/signin" className="btn btn--primary auth-callback__cta">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
