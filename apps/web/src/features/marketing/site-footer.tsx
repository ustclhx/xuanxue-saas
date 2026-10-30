import { Link } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { SiteLogo } from '../site/brand.tsx'
import { useSiteId } from '../site/context.tsx'
import { site } from './site.ts'

const footerLink = 'inline-flex min-h-11 items-center text-ink-subtle text-sm hover:text-ink'

/** 页脚区块：品牌（按站点）、产品、资源与法律页链接 */
export function SiteFooter() {
  const siteId = useSiteId()
  const brand = siteBrandName(templateConfig, siteId, getLocale())
  return (
    <footer className="border-line border-t bg-background">
      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-10 sm:grid-cols-4 sm:px-6">
        <div className="grid content-start gap-3">
          <p className="flex items-center gap-2 font-bold font-heading text-ink text-lg">
            <SiteLogo site={siteId} />
            {brand}
          </p>
          <p className="text-ink-subtle text-sm leading-relaxed">{m.common_site_tagline()}</p>
        </div>
        <FooterColumn title={m.marketing_footer_product()}>
          {templateConfig.billing.enabled && (
            <Link to="/pricing" className={footerLink}>
              {m.marketing_nav_pricing()}
            </Link>
          )}
          <Link to="/faq" className={footerLink}>
            {m.marketing_nav_faq()}
          </Link>
          <Link to="/register" className={footerLink}>
            {m.marketing_nav_get_started()}
          </Link>
        </FooterColumn>
        {(site.blog || site.docs) && (
          <FooterColumn title={m.marketing_footer_resources()}>
            {site.blog && (
              <Link to="/blog" className={footerLink}>
                {m.marketing_nav_blog()}
              </Link>
            )}
            {site.docs && (
              <Link to="/docs" className={footerLink}>
                {m.marketing_nav_docs()}
              </Link>
            )}
          </FooterColumn>
        )}
        <FooterColumn title={m.marketing_footer_legal()}>
          <Link to="/privacy" className={footerLink}>
            {m.marketing_footer_privacy()}
          </Link>
          <Link to="/terms" className={footerLink}>
            {m.marketing_footer_terms()}
          </Link>
          <Link to="/refund" className={footerLink}>
            {m.marketing_footer_refund()}
          </Link>
          <Link to="/disclaimer" className={footerLink}>
            {m.marketing_footer_disclaimer()}
          </Link>
        </FooterColumn>
      </div>
      <div className="mx-auto grid max-w-[1120px] gap-1 px-4 pb-8 text-ink-subtle text-xs sm:px-6">
        <p>{m.site_footer_disclaimer()}</p>
        <p>{m.marketing_footer_copyright({ year: new Date().getFullYear(), name: brand })}</p>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <p className="font-medium text-ink text-sm">{title}</p>
      {children}
    </div>
  )
}
