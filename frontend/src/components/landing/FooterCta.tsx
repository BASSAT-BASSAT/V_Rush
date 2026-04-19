import { Link } from 'react-router-dom'

/** Final CTA card: spend less time wiring, more time experimenting. */
export function FooterCta() {
  return (
    <section className="landing-cta">
      <div className="landing-cta__panel">
        <h2 className="landing-cta__title">Two ways in. One vision toolkit.</h2>
        <p className="landing-cta__body">
          Stack ops in the <strong>Studio</strong> or line up two frames in the
          {' '}<strong>Matcher</strong>. No accounts required for a quick look, no credit card ever.
        </p>
        <div className="landing-cta__row">
          <Link to="/studio" className="btn btn--primary btn--lg">
            Open the Studio
          </Link>
          <Link to="/match" className="btn btn--ghost btn--lg">
            Try the Matcher
          </Link>
          <Link to="/reference" className="btn btn--ghost btn--lg">
            Read the op reference
          </Link>
        </div>
      </div>
    </section>
  )
}
