import { Link } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { cn } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { SiteLogo } from '../site/brand.tsx'
import { useSiteId } from '../site/context.tsx'
import { siteNavLocale } from '../site/site.ts'
import { SiteSettings } from '../theme/site-settings.tsx'
import { blogHasPosts, site, useBlogLocales } from './site.ts'
import { SiteLink } from './site-link.tsx'

const footerLink = 'inline-flex min-h-11 items-center text-ink-subtle text-sm hover:text-ink'

/**
 * 页脚区块：品牌（按站点）、产品、资源与法律页链接。
 * floatingEntry：右下角有悬浮 AI 入口时页脚底部多留空白（模板 0.3.0），本项目目前未开启该入口。
 * 手机端无论有无 Ask AI 都留 80px：页面还可能有其他右下悬浮按钮（如 SubjectChat 触发器），
 * 不能遮挡设置行与版权（模板 0.5.1 UI-03）。
 * 手机端主题设置行放在版权行上方（模板 0.5.1，设计稿 docs/design-system/prototypes/mobile-footer-controls）；
 * data-site-footer 让根布局在本页隐藏页面末尾的同一设置行。
 */
export function SiteFooter({ floatingEntry = false }: { floatingEntry?: boolean } = {}) {
  const siteId = useSiteId()
  const locale = getLocale()
  const brand = siteBrandName(templateConfig, siteId, locale)
  // 东方站英文入口页没有英文的定价与法律页：链接到本站默认语言（D5，不跨站）
  const navLocale = siteNavLocale(siteId, locale, templateConfig)
  const blog = blogHasPosts(useBlogLocales(), navLocale)
  const link = (path: Parameters<typeof SiteLink>[0]['path'], label: string) => (
    <SiteLink path={path} locale={locale} navLocale={navLocale} className={footerLink}>
      {label}
    </SiteLink>
  )
  return (
    <footer
      data-site-footer
      className={cn(
        'border-line border-t bg-background pb-20',
        floatingEntry ? 'md:pb-34' : 'md:pb-0',
      )}
    >
      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-10 sm:grid-cols-4 sm:px-6">
        <div className="grid content-start gap-3">
          <p className="flex items-center gap-2 font-bold font-heading text-ink text-lg">
            <SiteLogo site={siteId} />
            {brand}
          </p>
          <p className="text-ink-subtle text-sm leading-relaxed">{m.common_site_tagline()}</p>
        </div>
        <FooterColumn title={m.marketing_footer_product()}>
          {templateConfig.billing.enabled && link('/pricing', m.marketing_nav_pricing())}
          {link('/faq', m.marketing_nav_faq())}
          <Link to="/register" className={footerLink}>
            {m.marketing_nav_get_started()}
          </Link>
        </FooterColumn>
        {(blog || site.docs || site.guides) && (
          <FooterColumn title={m.marketing_footer_resources()}>
            {blog && link('/blog', m.marketing_nav_blog())}
            {site.guides && (
              <Link to="/guides" className={footerLink}>
                {m.marketing_nav_guides()}
              </Link>
            )}
            {site.docs && link('/docs', m.marketing_nav_docs())}
          </FooterColumn>
        )}
        <FooterColumn title={m.marketing_footer_legal()}>
          {link('/privacy', m.marketing_footer_privacy())}
          {link('/terms', m.marketing_footer_terms())}
          {link('/refund', m.marketing_footer_refund())}
          {link('/disclaimer', m.marketing_footer_disclaimer())}
        </FooterColumn>
      </div>
      <div className="mx-auto grid max-w-[1120px] gap-1 px-4 text-ink-subtle text-xs sm:px-6 md:pb-8">
        <SiteSettings className="mb-3 border-line border-t py-4 print:hidden" />
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
