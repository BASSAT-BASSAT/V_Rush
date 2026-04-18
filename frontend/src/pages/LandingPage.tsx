import { useOutletContext } from 'react-router-dom'
import { FeatureGrid } from '../components/landing/FeatureGrid'
import { FooterCta } from '../components/landing/FooterCta'
import { Hero } from '../components/landing/Hero'
import { IntroBurst } from '../components/IntroBurst'
import { LandingCredits } from '../components/landing/LandingCredits'
import { ShowcaseGallery } from '../components/landing/ShowcaseGallery'
import { StatsStrip } from '../components/landing/StatsStrip'
import type { AppLayoutOutlet } from '../types/layout'

export function LandingPage() {
  const ctx = useOutletContext<AppLayoutOutlet | undefined>()
  const opCount = ctx?.ops.length ?? undefined

  return (
    <main className="landing">
      <IntroBurst />
      <Hero />
      <StatsStrip opCount={opCount} />
      <FeatureGrid />
      <ShowcaseGallery />
      <FooterCta />
      <LandingCredits />
    </main>
  )
}
