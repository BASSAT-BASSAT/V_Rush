import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getSupabase } from '../lib/supabase'

function authErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Authentication failed'
  const e = err as { message?: string; code?: string }
  const msg = typeof e.message === 'string' ? e.message : 'Authentication failed'
  const code = typeof e.code === 'string' ? e.code : ''
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Invalid email or password—or no account yet on this app. Use Sign up first for this site, or reset the password in Supabase Dashboard → Authentication → Users.'
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return `${msg} Check your inbox/spam, or disable “Confirm email” for testing in Supabase → Authentication → Providers → Email.`
  }
  return msg
}

export function AuthScreen() {
  const { session, bypass } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [canResendConfirmation, setCanResendConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  const nextPath = (() => {
    const raw = new URLSearchParams(location.search).get('next')
    if (!raw) return '/studio'
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/studio'
    return raw
  })()

  if (bypass || session) {
    return <Navigate to={nextPath} replace />
  }

  const callbackUrl = (() => {
    if (typeof window === 'undefined') return undefined
    const origin = window.location.origin.replace(/\/$/, '')
    return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
  })()

  const resendConfirmation = async () => {
    const addr = email.trim()
    if (!addr) return
    setError(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { error: err } = await sb.auth.resend({
        type: 'signup',
        email: addr,
        options: callbackUrl ? { emailRedirectTo: callbackUrl } : undefined,
      })
      if (err) throw err
      setInfo('Another confirmation link was sent. Check spam / Promotions in Gmail.')
    } catch (err: unknown) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const { error: err } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (err) throw err
      // On success the browser is being redirected — keep the spinner on.
    } catch (err: unknown) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setCanResendConfirmation(false)
    setBusy(true)
    try {
      const sb = getSupabase()
      if (mode === 'signup') {
        const { data, error: err } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: callbackUrl ? { emailRedirectTo: callbackUrl } : undefined,
        })
        if (err) throw err
        if (data.user && !data.session) {
          setInfo(
            'Account created. We sent a confirmation link — check your inbox (and Spam / Promotions in Gmail). Click it and you will be brought back here automatically.',
          )
          setCanResendConfirmation(true)
        }
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      }
    } catch (err: unknown) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__panel">
        <p className="auth-screen__eyebrow">V-Rush</p>
        <h2 className="auth-screen__title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <p className="auth-screen__hint">Continue with Google for one-click access, or use your email below.</p>

        <button
          type="button"
          className="auth-screen__google"
          onClick={() => void signInWithGoogle()}
          disabled={busy}
        >
          <svg
            className="auth-screen__google-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 18 18"
            aria-hidden
          >
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
            />
          </svg>
          <span>{busy ? 'Please wait…' : 'Continue with Google'}</span>
        </button>

        <div className="auth-screen__divider" role="separator" aria-label="or">
          <span>or</span>
        </div>

        <form className="auth-screen__form" onSubmit={(e) => void submit(e)}>
          <label className="auth-screen__field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className="auth-screen__field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={busy}
            />
          </label>
          {info && <p className="auth-screen__hint">{info}</p>}
          {error && <p className="auth-screen__error">{error}</p>}
          {canResendConfirmation && mode === 'signup' && (
            <button
              type="button"
              className="btn btn--ghost auth-screen__submit"
              disabled={busy || !email.trim()}
              onClick={() => void resendConfirmation()}
            >
              Resend confirmation email
            </button>
          )}
          <button type="submit" className="btn btn--primary auth-screen__submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className="auth-screen__switch">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button type="button" className="auth-screen__link" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="auth-screen__link" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
