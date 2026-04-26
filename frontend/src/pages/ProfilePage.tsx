import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MotionToast } from '../motion'

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  phone: string | null
  bio: string | null
  code_export_count: number | null
  studio_image_upload_count: number | null
  created_at: string | null
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? '').trim() || (email ?? '').trim()
  if (!source) return 'V'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letters.join('') || source[0]?.toUpperCase() || 'V'
}

function formatJoined(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
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
      .select('id, email, display_name, phone, bio, code_export_count, studio_image_upload_count, created_at')
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

  const initials = useMemo(
    () => getInitials(displayName || row?.display_name, row?.email),
    [displayName, row],
  )
  const joined = useMemo(() => formatJoined(row?.created_at), [row])
  const exportCount = row?.code_export_count ?? 0
  const uploadCount = row?.studio_image_upload_count ?? 0
  const bioCount = bio.length

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
      <section className="profile-page__hero" aria-labelledby="profile-hero-title">
        <div className="profile-page__hero-glow" aria-hidden />
        <div className="profile-page__hero-inner">
          <div className="profile-page__avatar" aria-hidden>
            <span>{initials}</span>
          </div>
          <div className="profile-page__identity">
            <span className="profile-page__eyebrow">Your profile</span>
            <h1 id="profile-hero-title" className="profile-page__name">
              {displayName || row?.display_name || row?.email?.split('@')[0] || 'V-Rush user'}
            </h1>
            <p className="profile-page__email">{row?.email}</p>
            {joined && <p className="profile-page__joined">Member since {joined}</p>}
          </div>
        </div>

        <div className="profile-page__stats" role="list">
          <div className="profile-page__stat" role="listitem">
            <span className="profile-page__stat-value">{uploadCount}</span>
            <span className="profile-page__stat-label">Images loaded</span>
          </div>
          <div className="profile-page__stat" role="listitem">
            <span className="profile-page__stat-value">{exportCount}</span>
            <span className="profile-page__stat-label">Pipeline exports</span>
          </div>
          <div className="profile-page__stat" role="listitem">
            <span className="profile-page__stat-value">{bioCount}</span>
            <span className="profile-page__stat-label">Bio characters</span>
          </div>
          <div className="profile-page__stat" role="listitem">
            <span className="profile-page__stat-value">{row?.phone ? '✓' : '—'}</span>
            <span className="profile-page__stat-label">Phone on file</span>
          </div>
        </div>
      </section>

      <MotionToast show={Boolean(error)} kind="error" className="profile-page__banner">
        {error}
      </MotionToast>
      <MotionToast show={Boolean(message)} kind="ok" className="profile-page__banner">
        {message}
      </MotionToast>

      <section className="profile-page__card" aria-labelledby="profile-account-title">
        <header className="profile-page__card-head">
          <h2 id="profile-account-title" className="profile-page__card-title">
            Account
          </h2>
          <p className="profile-page__card-hint">
            Read-only signals pulled from your session.
          </p>
        </header>

        <div className="profile-page__grid">
          <label className="profile-page__field">
            <span className="profile-page__label">Email</span>
            <input
              type="text"
              className="profile-page__input"
              value={row?.email ?? ''}
              readOnly
              disabled
            />
          </label>

          <label className="profile-page__field">
            <span className="profile-page__label">Images loaded in Studio</span>
            <input
              type="text"
              className="profile-page__input"
              value={String(uploadCount)}
              readOnly
              disabled
              title="Times you chose a new image (drop, tray, or open from Datasets)"
            />
          </label>

          <label className="profile-page__field">
            <span className="profile-page__label">Pipeline exports</span>
            <input
              type="text"
              className="profile-page__input"
              value={String(exportCount)}
              readOnly
              disabled
              title="Copy JSON, Copy Python, or Download .py from Export pipeline"
            />
          </label>
        </div>
      </section>

      <section className="profile-page__card" aria-labelledby="profile-public-title">
        <header className="profile-page__card-head">
          <h2 id="profile-public-title" className="profile-page__card-title">
            Public details
          </h2>
          <p className="profile-page__card-hint">
            How you appear when we show authors on shared pipelines.
          </p>
        </header>

        <div className="profile-page__grid">
          <label className="profile-page__field">
            <span className="profile-page__label">Display name</span>
            <input
              type="text"
              className="profile-page__input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={120}
              placeholder="e.g. Mohamed B."
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
              placeholder="Optional"
            />
          </label>
        </div>

        <label className="profile-page__field profile-page__field--full">
          <span className="profile-page__label">
            Bio
            <span className="profile-page__counter">{bioCount} / 2000</span>
          </span>
          <textarea
            className="profile-page__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="A line or two about what you build with V-Rush."
          />
        </label>

        <div className="profile-page__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>
    </div>
  )
}
