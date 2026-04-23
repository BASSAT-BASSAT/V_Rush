import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { ShowcaseItem } from './ShowcaseGallery'

interface Props {
  item: ShowcaseItem | null
  onClose: () => void
}

const STUDIO_LINKS: Record<string, { href: string; label: string }> = {
  mobile_sam: { href: '/lab', label: 'Open in the Deep Lab' },
  yolo26_detect: { href: '/lab', label: 'Open in the Deep Lab' },
  'matcher.sift': { href: '/match', label: 'Try this matcher' },
}

function studioLink(op: string) {
  return STUDIO_LINKS[op] ?? { href: '/studio', label: 'Use this op in the Studio' }
}

/**
 * Shared-layout expansion modal for a Showcase card. The motion.article in the
 * gallery and the modal share a `layoutId`, so Motion tweens between them.
 */
export function ShowcaseDetail({ item, onClose }: Props) {
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [item, onClose])

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="showcase-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.label} detail`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.article
            layoutId={`showcase-${item.op}`}
            className="showcase-modal__card"
            onClick={(e) => e.stopPropagation()}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div className="showcase-modal__pair">
              <div className="showcase-modal__img showcase-modal__img--before">
                {item.before}
                <span className="landing-showcase__tag">Before</span>
              </div>
              <div className="showcase-modal__img showcase-modal__img--after">
                {item.after}
                <span className="landing-showcase__tag landing-showcase__tag--after">After</span>
              </div>
            </div>
            <div className="showcase-modal__body">
              <div className="showcase-modal__head">
                <h3 className="showcase-modal__title">{item.label}</h3>
                <code className="landing-showcase__op">{item.op}</code>
              </div>
              {item.detail && <p className="showcase-modal__detail">{item.detail}</p>}
              <div className="showcase-modal__actions">
                <Link to={studioLink(item.op).href} className="btn btn--primary">
                  {studioLink(item.op).label}
                </Link>
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
            <button
              type="button"
              className="showcase-modal__x"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
