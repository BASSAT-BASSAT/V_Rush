import { Link } from 'react-router-dom'
import { MotionReveal } from '../../motion'

/** Final CTA card: spend less time wiring, more time experimenting. */
export function FooterCta() {
  return (
    <MotionReveal as="section" className="landing-cta" amount={0.2}>
      <div className="landing-cta__panel">
        <h2 className="landing-cta__title">Studio, Matcher, and video annotation — one toolkit.</h2>
        <div className="landing-cta__row">
          <Link to="/studio" className="btn btn--primary btn--lg">
            Open the Studio
          </Link>
          <Link to="/annotate" className="btn btn--ghost btn--lg">
            Annotate video
          </Link>
          <Link to="/match" className="btn btn--ghost btn--lg">
            Try the Matcher
          </Link>
          <Link to="/reference" className="btn btn--ghost btn--lg">
            Read the op reference
          </Link>
        </div>
      </div>
    </MotionReveal>
  )
}
