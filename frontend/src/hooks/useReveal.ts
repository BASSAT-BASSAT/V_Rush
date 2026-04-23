import { useEffect, useRef } from 'react'

interface Options {
  /** CSS class added once the element scrolls into view. */
  activeClass?: string
  /** How much of the element must be visible (0–1). */
  threshold?: number
  /** Only reveal once (default true). */
  once?: boolean
  /** Root-margin for the observer (e.g. "0px 0px -10% 0px"). */
  rootMargin?: string
}

/**
 * Adds a CSS class to the returned ref element the first time it scrolls into view.
 * Uses IntersectionObserver, respects `prefers-reduced-motion` by revealing immediately.
 */
export function useReveal<T extends HTMLElement>({
  activeClass = 'is-in',
  threshold = 0.15,
  once = true,
  rootMargin = '0px 0px -8% 0px',
}: Options = {}) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.classList.add(activeClass)
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add(activeClass)
            if (once) obs.unobserve(el)
          } else if (!once) {
            el.classList.remove(activeClass)
          }
        }
      },
      { threshold, rootMargin },
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [activeClass, threshold, once, rootMargin])

  return ref
}
