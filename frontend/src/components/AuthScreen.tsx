import { useState, type FormEvent } from 'react'
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
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [canResendConfirmation, setCanResendConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  const resendConfirmation = async () => {
    const addr = email.trim()
    if (!addr) return
    setError(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      const origin =
        typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
      const { error: err } = await sb.auth.resend({
        type: 'signup',
        email: addr,
        options: origin ? { emailRedirectTo: `${origin}/` } : undefined,
      })
      if (err) throw err
      setInfo('Another confirmation link was sent. Check spam / Promotions in Gmail.')
    } catch (err: unknown) {
      setError(authErrorMessage(err))
    } finally {
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
      const origin =
        typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
      if (mode === 'signup') {
        const { data, error: err } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: origin
            ? { emailRedirectTo: `${origin}/` }
            : undefined,
        })
        if (err) throw err
        if (data.user && !data.session) {
          setInfo(
            'Account created—Supabase will email a confirmation link (check Spam / Promotions). No email? Use Resend below, or turn off “Confirm email” in Supabase → Authentication → Providers → Email for testing.',
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
        <p className="auth-screen__eyebrow">KernelLab</p>
        <h2 className="auth-screen__title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <p className="auth-screen__hint">Use your email to access the CV playground. Confirm your email if required by your project settings.</p>

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
