import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  phone: string | null
  bio: string | null
  code_export_count: number | null
}

export function ProfilePage() {
  const { bypass, session } = useAuth()
  const navigate = useNavigate()
  const [row, setRow] = useState<ProfileRow | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (bypass) {
      navigate('/', { replace: true })
      return
    }
    if (!session?.user?.id) return

    const sb = getSupabase()
    void sb
      .from('profiles')
      .select('id, email, display_name, phone, bio')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error: e }) => {
        if (e) {
          setError(e.message)
          setLoading(false)
          return
        }
        const p = data as ProfileRow
        setRow(p)
        setDisplayName(p.display_name ?? '')
        setPhone(p.phone ?? '')
        setBio(p.bio ?? '')
        setLoading(false)
      })
  }, [bypass, session, navigate])

  const save = useCallback(async () => {
    if (!session?.user?.id) return
    setSaving(true)
    setMessage(null)
    setError(null)
    const sb = getSupabase()
    const { error: e } = await sb
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
      })
      .eq('id', session.user.id)
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    setMessage('Profile saved.')
  }, [session, displayName, phone, bio])

  if (bypass) return null

  if (loading) {
    return (
      <div className="profile-page">
        <p className="panel-hint">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <section className="dock-panel profile-page__panel">
        <h2 className="profile-page__title">Your profile</h2>

        {error && <div className="banner banner--error">{error}</div>}
        {message && <div className="banner banner--ok">{message}</div>}

        <label className="profile-page__field">
          <span className="profile-page__label">Email</span>
          <input type="text" className="profile-page__input" value={row?.email ?? ''} readOnly disabled />
        </label>

        <label className="profile-page__field">
          <span className="profile-page__label">Python code exports</span>
          <input
            type="text"
            className="profile-page__input"
            value={String(row?.code_export_count ?? 0)}
            readOnly
            disabled
            title="Times you copied or downloaded pipeline Python from the main page"
          />
        </label>

        <label className="profile-page__field">
          <span className="profile-page__label">Display name</span>
          <input
            type="text"
            className="profile-page__input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            maxLength={120}
          />
        </label>

        <label className="profile-page__field">
          <span className="profile-page__label">Phone</span>
          <input
            type="tel"
            className="profile-page__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            maxLength={32}
          />
        </label>

        <label className="profile-page__field">
          <span className="profile-page__label">Bio</span>
          <textarea
            className="profile-page__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={2000}
          />
        </label>

        <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </section>
    </div>
  )
}
