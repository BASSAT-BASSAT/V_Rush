import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { fetchOps } from '../api/cv'
import { NewsletterForm } from './NewsletterForm'
import { useAuth } from '../hooks/useAuth'
import type { AppLayoutOutlet } from '../types/layout'

export function AppLayout() {
  const { bypass, session, accessToken, signOut } = useAuth()
  const location = useLocation()
  const [ops, setOps] = useState<AppLayoutOutlet['ops']>([])
  const [opsError, setOpsError] = useState<string | null>(null)

  useEffect(() => {
    fetchOps(accessToken)
      .then(setOps)
      .catch((e: unknown) => setOpsError(e instanceof Error ? e.message : 'Failed to load ops'))
  }, [accessToken])

  const outletCtx: AppLayoutOutlet = { ops, opsError, accessToken }

  return (
    <div className="app">
      <div className="app__aurora" aria-hidden />
      <div className="app__grid-bg" aria-hidden />

      <div className="app__shell">
        <header className="app__header">
          <div className="app__header-inner">
            <div className="brand">
              <NavLink to="/" className="brand__link" end>
                <div className="brand__mark" aria-hidden>
                  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand__svg">
                    <defs>
                      <linearGradient id="klg" x1="8" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#5eead4" />
                        <stop offset="1" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="32" height="32" rx="9" stroke="url(#klg)" strokeWidth="2" fill="rgba(94,234,212,0.06)" />
                    <path
                      d="M12 20h6l4-8 4 16 4-8h6"
                      stroke="url(#klg)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="brand__text">
                  <p className="brand__eyebrow">Classical computer vision</p>
                  <h1 className="brand__title">KernelLab</h1>
                  <p className="tagline">Stack OpenCV-style ops, run the pipeline, compare before and after in one place.</p>
                </div>
              </NavLink>
            </div>
            <div className="app__header-right">
              <nav className="app__nav" aria-label="Main">
                <NavLink to="/" className={({ isActive }) => `app__nav-link${isActive ? ' app__nav-link--on' : ''}`} end>
                  Pipeline
                </NavLink>
                <NavLink to="/reference" className={({ isActive }) => `app__nav-link${isActive ? ' app__nav-link--on' : ''}`}>
                  Reference
                </NavLink>
                {!bypass && session && (
                  <NavLink to="/profile" className={({ isActive }) => `app__nav-link${isActive ? ' app__nav-link--on' : ''}`}>
                    Profile
                  </NavLink>
                )}
              </nav>
              {!bypass && session && (
                <div className="app__user">
                  <span className="app__user-email" title={session.user.email ?? ''}>
                    {session.user.email}
                  </span>
                  <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </div>
              )}
              {location.pathname === '/' && (
                <div className="app__header-badges">
                  <span className="chip chip--accent">{ops.length ? `${ops.length} ops` : 'Loading…'}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <Outlet context={outletCtx} />

        <footer className="app__footer">
          <div className="app__footer-row">
            <span className="app__footer-brand">KernelLab</span>
            <span className="app__footer-sep" aria-hidden>
              ·
            </span>
            <span className="app__footer-founder">
              Founder: <strong>Mohamed ElBassat</strong>
            </span>
            <span className="app__footer-sep" aria-hidden>
              ·
            </span>
            <a className="app__footer-link" href="mailto:mohamedd77bassat@gmail.com">
              mohamedd77bassat@gmail.com
            </a>
          </div>
          {!bypass && (
            <div className="app__footer-newsletter">
              <NewsletterForm />
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
