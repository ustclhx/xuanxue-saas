import { templateConfig } from '../../server/template-config.ts'
import { GrowthForm } from '../growth/forms.tsx'
import { placeholderPlans } from './pricing-placeholder.ts'
import { Cta } from './sections/cta.tsx'
import { Faq } from './sections/faq.tsx'
import { Features } from './sections/features.tsx'
import { Hero } from './sections/hero.tsx'
import { Pricing } from './sections/pricing.tsx'
import { Testimonials } from './sections/testimonials.tsx'

/** 模板营销首页：只在西方站首页长文缺失时使用，由首页路由按需加载 */
export function TemplateHome() {
  return (
    <>
      <Hero />
      <Features />
      {templateConfig.billing.enabled && <Pricing plans={placeholderPlans} />}
      <Testimonials />
      <Faq />
      <Cta />
      {templateConfig.features.waitlist ? <GrowthForm feature="waitlist" /> : null}
      {templateConfig.features.newsletter ? <GrowthForm feature="newsletter" /> : null}
    </>
  )
}
