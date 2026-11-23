import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData, webApplicationData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import type { YearlyToolCopy } from './copy/types.ts'
import { YearlyToolPage } from './page.tsx'
import { isYearlyToolLocale, YEARLY_TOOL_PATHS, type YearlyToolLocale } from './paths.ts'

export interface YearlyToolPayload {
  readonly locale: YearlyToolLocale
  readonly copy: YearlyToolCopy
}

// 每种语言的文案各成一个 chunk，loader 只加载当前语言（与页面数据一同序列化，不进其他语言的包）
const copies = import.meta.glob<{ COPY: YearlyToolCopy }>('./copy/{zh-Hans,zh-Hant,ko,en}.ts')

export async function loadYearlyToolCopy(locale: YearlyToolLocale): Promise<YearlyToolCopy> {
  const importCopy = copies[`./copy/${locale}.ts`]
  if (!importCopy) throw new Error(`Missing yearly-tool copy: ${locale}`)
  return (await importCopy()).COPY
}

/**
 * head：canonical 自指，hreflang 由注册表四种语言的地址生成（seo `alternateLinks` 按 TOOL_ROUTES 查找）；
 * 结构化数据为 WebApplication、面包屑「首页 › 2027流年」与 FAQPage（与页面可见 FAQ 同一组文案）。
 * 页面不查数据库，构建期预渲染。
 */
export function yearlyToolHead(payload: YearlyToolPayload) {
  const { locale, copy } = payload
  const page = {
    site: 'east' as const,
    path: YEARLY_TOOL_PATHS[locale],
    locale,
    title: copy.seo.title,
    description: copy.seo.description,
  }
  return pageHead(page, '', [
    webApplicationData(page, copy.h1),
    breadcrumbData(
      [
        { name: m.marketing_nav_home(), path: '/' },
        { name: copy.crumb, path: page.path },
      ],
      locale,
      'east',
    ),
    faqPageData(copy.faq.map((item) => ({ question: item.q, answer: item.a }))),
  ])
}

export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  if (!isYearlyToolLocale(route.locale)) return null
  const payload: YearlyToolPayload = {
    locale: route.locale,
    copy: await loadYearlyToolCopy(route.locale),
  }
  return { head: yearlyToolHead(payload), content: payload }
}

export function Page({ data }: { data: EastContentData }) {
  const payload = data.content as YearlyToolPayload
  return (
    <MarketingShell>
      <YearlyToolPage locale={payload.locale} copy={payload.copy} />
    </MarketingShell>
  )
}
