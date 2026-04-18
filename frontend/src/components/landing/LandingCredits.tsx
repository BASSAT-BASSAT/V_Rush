import { useMemo } from 'react'

const COFOUNDERS = [
  {
    name: 'Mohamed Elbassat',
    role: 'Co-Founder · Engineering',
    initials: 'ME',
    email: 'mohamedd77bassat@gmail.com',
  },
  {
    name: 'Rokayya Aly',
    role: 'Co-Founder · Engineering',
    initials: 'RA',
    email: 'mohamedd77bassat@gmail.com',
  },
]

const CONTACT_EMAIL = 'mohamedd77bassat@gmail.com'

export function LandingCredits() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <section className="landing-credits" id="about" aria-labelledby="landing-credits-title">
      <header className="landing-credits__head">
        <span className="landing-credits__eyebrow">The team</span>
        <h2 id="landing-credits-title" className="landing-credits__title">
          Built by two founders who live in the pixels.
        </h2>
        <p className="landing-credits__lede">
          V-Rush is an independent studio project. We answer our own email, ship our own code,
          and obsess over every edge.
        </p>
      </header>

      <ul className="landing-credits__people" role="list">
        {COFOUNDERS.map((person) => (
          <li key={person.name} className="landing-credits__card">
            <div className="landing-credits__avatar" aria-hidden>
              {person.initials}
            </div>
            <div className="landing-credits__meta">
              <p className="landing-credits__name">{person.name}</p>
              <p className="landing-credits__role">{person.role}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="landing-credits__contact" id="contact">
        <div className="landing-credits__contact-text">
          <h3 className="landing-credits__contact-title">Get in touch</h3>
          <p className="landing-credits__contact-body">
            Questions, partnerships, or a bug you want fixed? Drop us a line &mdash; we read
            everything.
          </p>
        </div>
        <a
          className="btn btn--primary btn--lg landing-credits__contact-btn"
          href={`mailto:${CONTACT_EMAIL}?subject=V-Rush%20%E2%80%94%20hello`}
        >
          {CONTACT_EMAIL}
        </a>
      </div>

      <div className="landing-credits__legal">
        <p className="landing-credits__legal-line">
          <span className="landing-credits__mark">V-Rush&trade;</span> and the V-Rush logo are
          trademarks of V-Rush. All product names, logos, and brands used on this site are
          property of their respective owners.
        </p>
        <p className="landing-credits__copyright">
          &copy; {year} V-Rush&trade;. All rights reserved.
        </p>
      </div>
    </section>
  )
}
