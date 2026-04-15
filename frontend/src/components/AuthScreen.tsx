import { useState, type FormEvent } from 'react'
import { getSupabase } from '../lib/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const sb = getSupabase()
      if (mode === 'signup') {
        const { error: err } = await sb.auth.signUp({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
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
          {error && <p className="auth-screen__error">{error}</p>}
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
