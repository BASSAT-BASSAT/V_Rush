import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { fetchOps } from '../api/cv'
import { NewsletterForm } from './NewsletterForm'
import { ThemeToggle } from './ThemeToggle'
import { WaveBackdrop } from './WaveBackdrop'
import { useAuth } from '../hooks/useAuth'
import type { AppLayoutOutlet } from '../types/layout'

export function AppLayout() {
  const { bypass, session, accessToken, signOut } = useAuth()
  const location = useLocation()
  const [ops, setOps] = useState<AppLayoutOutlet['ops']>([])
  const [opsError, setOpsError] = useState<string | null>(null)

  const isLanding = location.pathname === '/'
  const isStudio =
    location.pathname.startsWith('/studio') || location.pathname.startsWith('/lab')

  useEffect(() => {
    // Only fetch ops once the studio is open, since /api/ops requires auth.
    if (!isStudio) return
    fetchOps(accessToken)
      .then(setOps)
      .catch((e: unknown) => setOpsError(e instanceof Error ? e.message : 'Failed to load ops'))
  }, [accessToken, isStudio])

  const outletCtx: AppLayoutOutlet = { ops, opsError, accessToken }
  const reduced = useReducedMotion()
  // Group all auth-callback / signin paths together so that internal sub-state
  // changes don't re-fire the page transition.
  // Keep /studio and /lab under one key so AnimatePresence does not remount the
  // pipeline workspace when switching Classical ↔ Deep (state must persist).
  const firstSeg = location.pathname.split('/')[1] || 'home'
  const transitionKey =
    firstSeg === 'studio' || firstSeg === 'lab' ? 'pipeline-workspace' : firstSeg

  return (
    <div className="app">
      <div className="app__aurora" aria-hidden />
      <div className="app__grid-bg" aria-hidden />
      <WaveBackdrop />

      <div className="app__shell">
        <header className="app__header">
          <div className="app__header-inner">
            <div className="brand">
              <NavLink to="/" className="brand__link" end>
                <div className="brand__mark" aria-hidden>
                  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand__svg">
                    <defs>
                      <linearGradient id="klg" x1="8" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#c4b5fd" />
                        <stop offset="1" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="32" height="32" rx="9" stroke="url(#klg)" strokeWidth="2" fill="rgba(139,92,246,0.08)" />
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
                  <h1 className="brand__title">V-Rush</h1>
                  <p className="tagline">Stack OpenCV ops, match keypoints, and pull from Kaggle — one workbench for every pipeline.</p>
                </div>
              </NavLink>
            </div>
            <div className="app__header-right">
              <nav className="app__nav" aria-label="Main">
                <NavLink to="/" className={({ isActive }) => `app__nav-link${isActive ? ' app__nav-link--on' : ''}`} end>
                  Home
                </NavLink>
                <NavLink to="/studio" className={({ isActive }) => `app__nav-link${isActive || location.pathname.startsWith('/lab') ? ' app__nav-link--on' : ''}`}>
                  Studio
                </NavLink>
                <NavLink to="/match" className={({ isActive }) => `app__nav-link${isActive ? ' app__nav-link--on' : ''}`}>
                  Matcher
                </NavLink>
                <NavLink to="/datasets" className={({ isActive }) => `app__nav-link${isActive ? ' app__nav-link--on' : ''}`}>
                  Datasets
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
              <ThemeToggle />
              {!bypass && session ? (
                <div className="app__user">
                  <span className="app__user-email" title={session.user.email ?? ''}>
                    {session.user.email}
                  </span>
                  <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </div>
              ) : (
                !bypass && !isLanding && (
                  <NavLink to="/signin" className="btn btn--primary btn--sm">
                    Sign in
                  </NavLink>
                )
              )}
              {isStudio && ops.length > 0 && (
                <div className="app__header-badges">
                  <span className="chip chip--accent">{`${ops.length} ops`}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={transitionKey}
            className="app__route"
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={reduced ? { duration: 0 } : { duration: 0.28, ease: [0.16, 0.84, 0.32, 1] }}
          >
            <Outlet context={outletCtx} />
          </motion.div>
        </AnimatePresence>

        <footer className="app__footer">
          <div className="app__footer-row">
            <span className="app__footer-brand">V-Rush&trade;</span>
            <span className="app__footer-sep" aria-hidden>
              ·
            </span>
            <span className="app__footer-rights">
              &copy; {new Date().getFullYear()} V-Rush. All rights reserved.
            </span>
            {isLanding && (
              <>
                <span className="app__footer-sep" aria-hidden>
                  ·
                </span>
                <a className="app__footer-link" href="#about">
                  Founders
                </a>
                <span className="app__footer-sep" aria-hidden>
                  ·
                </span>
                <a className="app__footer-link" href="#contact">
                  Contact
                </a>
              </>
            )}
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
