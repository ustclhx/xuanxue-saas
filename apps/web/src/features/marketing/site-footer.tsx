import { Link } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { cn } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { SiteLogo } from '../site/brand.tsx'
import { useSiteId } from '../site/context.tsx'
import { EAST_ENGLISH_LOCALE, siteNavLocale } from '../site/site.ts'
import { LanguageSetting, ThemeSetting } from '../theme/site-settings.tsx'
import { blogHasPosts, site, useBlogLocales } from './site.ts'
import { SiteLink } from './site-link.tsx'

const footerLink =
  'inline-flex min-h-11 items-center text-body text-ink-muted no-underline hover:text-ink'

/**
 * 页脚（openspec refresh-visual-system-warm design.md D7、D9，设计稿 warm-refresh/Components*.dc.html）：
 * 顶部一条细线；品牌与一句标语、一组链接（常见问题、博客、指南、文档与法律页）；设置行（主题、语言）；
 * 合规声明为 caption 小字；版权。定价与工具的入口在页头，页脚不重复。
 * floatingEntry：右下角有悬浮 AI 入口时页脚底部多留空白（模板 0.3.0），本项目目前未开启该入口。
 * 手机端无论有无 Ask AI 都留 80px：页面还可能有其他右下悬浮按钮（如 SubjectChat 触发器），
 * 不能遮挡设置行与版权（模板 0.5.1 UI-03）。
 * data-site-footer 让根布局在本页隐藏页面末尾的同一设置行。
 * data-link-zone="nav"：链接图检查把页脚当作导航层，并只在此区域统计页脚链接数（模板 0.7.3 seo-internal-linking）。
 */
export function SiteFooter({ floatingEntry = false }: { floatingEntry?: boolean } = {}) {
  const siteId = useSiteId()
  const locale = getLocale()
  const brand = siteBrandName(templateConfig, siteId, locale)
  // 东方站英文入口页没有英文的定价与法律页：链接到本站默认语言（D5，不跨站）；
  // 东方站根路径英文（5b）发布后链接本站英文的常见问题与法律页，没有博客、指南与文档
  const navLocale = siteNavLocale(siteId, locale, templateConfig)
  const eastEnglish = siteId === 'east' && navLocale === EAST_ENGLISH_LOCALE
  const blogLocales = useBlogLocales()
  const blog = !eastEnglish && blogHasPosts(blogLocales, navLocale)
  const link = (path: Parameters<typeof SiteLink>[0]['path'], label: string) => (
    <SiteLink path={path} locale={locale} navLocale={navLocale} className={footerLink}>
      {label}
    </SiteLink>
  )
  return (
    <footer
      data-site-footer
      data-link-zone="nav"
      className={cn(
        'border-line border-t bg-background pt-10 pb-20 sm:pt-12',
        floatingEntry ? 'md:pb-34' : 'md:pb-10',
      )}
    >
      <PageWidth className="flex flex-col gap-7">
        <div className="flex flex-col gap-5 md:flex-row md:justify-between md:gap-12">
          <div className="flex max-w-80 flex-col gap-2">
            <p className="m-0 flex items-center gap-2 font-heading text-ink text-subtitle">
              <SiteLogo site={siteId} />
              {brand}
            </p>
            <p className="m-0 text-caption text-ink-subtle">{m.common_site_tagline()}</p>
          </div>
          <nav
            aria-label={m.site_footer_nav()}
            className="grid grid-cols-2 content-start gap-x-4 md:grid-cols-4 md:gap-x-10"
          >
            {link('/faq', m.marketing_nav_faq())}
            {blog && link('/blog', m.marketing_nav_blog())}
            {site.guides && !eastEnglish && (
              <Link to="/guides" className={footerLink}>
                {m.marketing_nav_guides()}
              </Link>
            )}
            {site.docs && !eastEnglish && link('/docs', m.marketing_nav_docs())}
            {link('/privacy', m.marketing_footer_privacy())}
            {link('/terms', m.marketing_footer_terms())}
            {link('/refund', m.marketing_footer_refund())}
            {link('/disclaimer', m.marketing_footer_disclaimer())}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 print:hidden">
          <ThemeSetting className="w-full md:w-auto md:justify-start" />
          <LanguageSetting className="w-full md:w-auto md:justify-start" />
        </div>
        {/* 不加 role="note"：页面正文里的合规声明才是 note，页脚这条是全站通用的小字 */}
        <p className="m-0 max-w-180 text-caption text-ink-subtle">{m.tools_ai_disclaimer()}</p>
        <p className="m-0 text-caption text-ink-subtle">
          {m.marketing_footer_copyright({ year: new Date().getFullYear(), name: brand })}
        </p>
      </PageWidth>
    </footer>
  )
}
