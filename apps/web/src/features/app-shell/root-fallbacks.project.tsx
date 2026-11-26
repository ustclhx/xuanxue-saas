// 项目自有：模板只创建本文件，之后不再修改（template-release 检查），template-sync 不会在这里冲突。
// 根路由与路由器默认的 404 / 兜底错误界面（__root.tsx、router.tsx）从这里取，分享页等未自带错误界面的路由同样使用。
// 错误界面不要显示错误详情（可能含内部信息），并给出回到站内的链接（public-site-availability「兜底错误界面」）。
import { useRouter } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { Button } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, type Locale, localizeHref } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { contentLinks } from '../marketing/content-links.ts'
import { ContentHead, ContentPage, inlineLinks } from '../marketing/content-page.tsx'
import { MarketingShell } from '../marketing/marketing-shell.tsx'
import { useSiteId } from '../site/context.tsx'
import { siteNavLocale } from '../site/site.ts'

/** 404 与错误界面共用：营销站点开启时带站点页头与页脚；关闭时只输出正文。 */
function StatusShell({ children }: { children: ReactNode }) {
  if (templateConfig.marketing.enabled) return <MarketingShell>{children}</MarketingShell>
  return (
    <main data-surface="marketing" className="text-body">
      {children}
    </main>
  )
}

/** 回到本站首页的主按钮；按本站导航语言生成地址，不落到另一站点或本站不存在的语言路径。 */
function HomeLink({ locale }: { locale: Locale }) {
  const site = useSiteId()
  return (
    <a
      href={localizeHref('/', { locale })}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-7 font-medium text-body text-on-brand no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 sm:w-auto"
    >
      {m.common_not_found_home({ brand: siteBrandName(templateConfig, site, locale) })}
    </a>
  )
}

function useNavLocale(): Locale {
  return siteNavLocale(useSiteId(), getLocale(), templateConfig) as Locale
}

/**
 * 404 页（保持 404 状态，不跳转首页；设计稿 warm-refresh/NotFound.dc.html）：小字「错误 404」、H1、一句说明
 * 与回到本站首页的主按钮。说明里链接本站的主工具与三张牌塔罗（正文内链 2 条）。
 */
export function RootNotFound() {
  const locale = useNavLocale()
  return (
    <StatusShell>
      <ContentPage>
        <ContentHead
          eyebrow={
            <p className="m-0 text-caption text-ink-subtle">{m.common_not_found_eyebrow()}</p>
          }
          title={m.common_not_found_title()}
        >
          <p className="m-0 text-body text-ink-muted">
            {inlineLinks(m.common_not_found_body({}, { locale }), contentLinks(locale))}
          </p>
          <p className="m-0 mt-3 flex">
            <HomeLink locale={locale} />
          </p>
        </ContentHead>
      </ContentPage>
    </StatusShell>
  )
}

/**
 * 兜底错误界面：渲染或数据读取发生未处理错误时代替框架默认错误页，沿用 404 页的版式；
 * 不显示错误详情，错误已由服务端入口记录与上报。重试会重新执行当前路由的 loader。
 */
export function RootError() {
  const router = useRouter()
  const locale = useNavLocale()
  return (
    <StatusShell>
      <ContentPage>
        <ContentHead title={m.common_error_title()}>
          <p className="m-0 text-body text-ink-muted">{m.common_error_body()}</p>
          <p className="m-0 mt-3 flex flex-wrap gap-3">
            <HomeLink locale={locale} />
            <Button type="button" variant="outline" onClick={() => void router.invalidate()}>
              {m.common_error_retry()}
            </Button>
          </p>
        </ContentHead>
      </ContentPage>
    </StatusShell>
  )
}
