import { useState, type FormEvent } from 'react'
import { getSupabase } from '../lib/supabase'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage(null)
    try {
      const sb = getSupabase()
      const { error } = await sb.from('email_subscribers').insert({ email: email.trim().toLowerCase() })
      if (error) {
        if (error.code === '23505') {
          setMessage("You're already on the list. Thanks!")
          setStatus('ok')
          return
        }
        throw error
      }
      setMessage('Thanks — we saved your email.')
      setStatus('ok')
      setEmail('')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Could not subscribe')
      setStatus('err')
    }
  }

  return (
    <form className="newsletter" onSubmit={(e) => void submit(e)}>
      <span className="newsletter__label">Updates</span>
      <div className="newsletter__row">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'loading'}
          className="newsletter__input"
          aria-label="Email for updates"
        />
        <button type="submit" className="btn newsletter__btn" disabled={status === 'loading'}>
          {status === 'loading' ? '…' : 'Subscribe'}
        </button>
      </div>
      {message && <p className={`newsletter__msg ${status === 'err' ? 'newsletter__msg--err' : ''}`}>{message}</p>}
    </form>
  )
}
