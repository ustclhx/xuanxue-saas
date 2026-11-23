import type { SiteId } from '@xuanxue/config'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { eastContentRouteOf } from '../../east-content/routes.ts'
import { eastEnContentRouteOf, isEastEnglishOnlyPath } from '../../east-en/paths.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../../marketing/prerender.ts'
import { checkCompliance } from '../../readings/compliance.ts'
import { llmsTxt } from '../../seo/crawlers.ts'
import { publicPages } from '../../seo/pages.ts'
import { routeSite } from '../../site/gate.ts'
import { westContentRouteOf } from '../../west-content/routes.ts'
import { directoryGroups } from '../directory.ts'
import { TOOL_ROUTES } from '../registry.ts'
import { toolHref } from '../tool-href.ts'
import { toolsHubHead } from './head.ts'
import { ToolsHubPage } from './page.tsx'
import { TOOLS_HUB_ID, TOOLS_HUB_PATHS } from './routes.ts'

const language = vi.hoisted(() => ({ locale: 'zh-Hans' }))
vi.mock('../../../paraglide/runtime.js', async (original) => ({
  ...(await original<typeof import('../../../paraglide/runtime.js')>()),
  getLocale: () => language.locale,
}))
// 页头与页脚有自己的测试（marketing/site-header.test.tsx）；这里只看枢纽页正文
vi.mock('../../marketing/marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const HUBS = [
  ['east', 'zh-Hans'],
  ['east', 'zh-Hant'],
  ['east', 'ko'],
  ['east', 'ja'],
  ['east', 'en'],
  ['west', 'en'],
  ['west', 'es'],
] as const

function render(
  site: SiteId,
  locale: string,
  props: Partial<Parameters<typeof ToolsHubPage>[0]> = {},
) {
  language.locale = locale
  // 不执行脚本的服务端 HTML：爬虫看到的就是这份
  return renderToStaticMarkup(<ToolsHubPage site={site} locale={locale} {...props} />)
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const hrefs = (html: string) =>
  [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1] ?? '')
const groupIds = (html: string) =>
  [...html.matchAll(/data-hub-group="group-([\w-]+)"/g)].map((match) => match[1])

describe('「全部工具」枢纽页', () => {
  it.each(HUBS)(
    '%s %s：无 JS 的 HTML 按分组列出本语言全部工具，每个入口是真实链接',
    (site, locale) => {
      const html = render(site, locale)
      const groups = directoryGroups(site, locale)
      expect(groups.length).toBeGreaterThan(0)
      // 分组顺序与注册表的分组顺序一致，没有空分组
      expect(groupIds(html)).toEqual(groups.map(({ group }) => group))
      const links = hrefs(html)
      for (const { tools } of groups)
        for (const tool of tools) {
          expect(links, `${tool.id}`).toContain(toolHref(tool.path, locale))
          expect(html).toContain(`data-tool="${tool.id}"`)
        }
      // 一个 H1；面包屑回到本语言首页；枢纽页不列出自己
      expect(html.match(/<h1\b/g)).toHaveLength(1)
      expect(links[0]).toBe(toolHref('/', locale))
      expect(html).not.toContain(`data-tool="${TOOLS_HUB_ID}"`)
      // 分组里的卡片与链接列表是模板区块，不计正文内链；说明里的两条句内链接是正文链接
      expect(html.match(/data-link-zone="related"/g)).toHaveLength(groups.length)
      const start = html.match(/<p data-hub-start[\s\S]*?<\/p>/)?.[0] ?? ''
      expect(hrefs(start)).toHaveLength(2)
    },
  )

  it.each(HUBS)(
    '%s %s：入口卡只标动作式免费标签，不写 AI、不标付费，合规声明沿用现有措辞',
    (site, locale) => {
      const html = render(site, locale)
      const cards = html.match(/data-tool-card="row"/g) ?? []
      expect(html.match(/data-tool-label="free"/g)).toHaveLength(cards.length)
      expect(html).not.toContain('data-tool-label="paid"')
      expect(text(html)).not.toMatch(/\bAI\b|\bIA\b|付费|付費|유료|有料|会员|會員/)
      expect(text(html)).not.toMatch(/自我探索|띠별 운세|娱乐|娛樂/)
      expect(html).toContain('role="note"')
      expect(
        checkCompliance(
          html.replace(/<\/(?:p|li|h[1-6]|div|section)>/g, '\n\n').replace(/<[^>]+>/g, ' '),
          locale,
        ).violations,
      ).toEqual([])
    },
  )

  it('简体中文的声明为「仅供参考与潜意识探索」，不预测未来', () => {
    const html = render('east', 'zh-Hans')
    expect(text(html)).toContain('依传统规则计算，仅供参考与潜意识探索。不预测未来')
  })

  it('西方站没有生肖与历法分组，也没有指向东方站的链接；东方站不列西方站工具', () => {
    const west = render('west', 'en')
    // 西方星座（astrology）与月相（moon）是西方站自己的分组；不出现东方的生肖、八字、紫微与历法
    expect(groupIds(west)).toEqual(['tarot', 'numerology', 'astrology', 'moon', 'compatibility'])
    expect(text(west)).not.toMatch(/chinese zodiac|bazi|zi wei|almanac/i)
    const eastOnly = new Set(
      TOOL_ROUTES.filter((route) => route.site === 'east').flatMap((route) =>
        Object.values(route.paths),
      ),
    )
    const westPaths = new Set(
      TOOL_ROUTES.filter((route) => route.site === 'west').flatMap((route) =>
        Object.values(route.paths),
      ),
    )
    for (const href of hrefs(west)) {
      // 站内相对地址：没有域名，不指向只属于东方站的路径
      expect(href).toMatch(/^(?:\/(?!\/)|#)/)
      const path = decodeURI(href)
      if (eastOnly.has(path)) expect(westPaths.has(path), href).toBe(true)
    }
    for (const [site, locale] of HUBS) {
      const html = render(site, locale)
      // 全部是站内相对地址或页内锚点：没有任何带域名的链接
      for (const href of hrefs(html)) expect(href).toMatch(/^(?:\/(?!\/)|#)/)
      const other = site === 'east' ? 'west' : 'east'
      const own = new Set(directoryGroups(site, locale).flatMap((g) => g.tools.map((t) => t.id)))
      const foreign = TOOL_ROUTES.filter((route) => route.site === other && !own.has(route.id))
      for (const route of foreign) expect(html).not.toContain(`data-tool="${route.id}"`)
    }
    expect(render('east', 'zh-Hans')).not.toContain('data-tool="life-path"')
  })

  it('空分组不显示：标题与跳转标签都不渲染，也没有「即将上线」', () => {
    const routes = TOOL_ROUTES.filter((route) => route.directoryGroup !== 'divination')
    const html = render('east', 'zh-Hans', { routes })
    expect(groupIds(html)).toEqual(['chart', 'relation', 'yearly', 'calendar', 'knowledge'])
    expect(html).not.toContain('#group-divination')
    expect(text(html)).not.toMatch(/在线占卜|即将/)
    // 东方站英文没有历法页面：这一组本来就不出现
    expect(groupIds(render('east', 'en'))).toEqual([
      'chart',
      'relation',
      'yearly',
      'divination',
      'knowledge',
    ])
  })

  it('小标到期后不渲染；未发布语言不显示入口与小标；集合下级页不进枢纽页', () => {
    const card = (html: string, id: string) =>
      html.split(/<li\b/).find((item) => item.includes(`data-tool="${id}"`)) ?? ''
    const badge = (html: string, id: string) =>
      card(html, id).match(/data-tool-label="new"[^>]*>([^<]*)</)?.[1] ?? null
    // 个人流年与 2027 生肖枢纽为 nav: false（不进页头下拉），仍列在年运分组；配对页不进枢纽页
    const before = render('east', 'zh-Hans', { today: '2027-02-28' })
    expect(groupIds(before)).toContain('relation')
    expect(badge(before, 'yearly-tool')).toBe('2027')
    expect(badge(before, 'yearly-2027')).toBe('2027')
    expect(badge(before, 'zodiac-pair')).toBe('新')
    expect(before).not.toContain('data-tool="zodiac-pair-zi-chou"')
    // 3-01：小标都不再渲染，入口保留
    const after = render('east', 'zh-Hans', { today: '2027-03-01' })
    for (const id of ['yearly-tool', 'yearly-2027', 'zodiac-pair']) {
      expect(after).toContain(`data-tool="${id}"`)
      expect(badge(after, id)).toBeNull()
    }
    // 繁中没有生肖配对与 2027 生肖枢纽：入口与小标都不出现；太歲页与个人流年列在年运分组
    const hant = render('east', 'zh-Hant', { today: '2027-02-28' })
    expect(hant).not.toContain('data-tool="zodiac-pair"')
    expect(hant).not.toContain('data-tool="yearly-2027"')
    expect(badge(hant, 'tai-sui-2027')).toBe('2027')
    expect(badge(hant, 'yearly-tool')).toBe('2027')
  })
})

describe('枢纽页的地址、head 与发现', () => {
  it('各语言地址取使用者确认的默认值，两站各自登记', () => {
    expect(TOOLS_HUB_PATHS).toEqual({
      east: { 'zh-Hant': '/工具', 'zh-Hans': '/工具', ko: '/도구', ja: '/ツール', en: '/tools' },
      west: { en: '/tools', es: '/herramientas' },
    })
    for (const locale of ['zh-Hant', 'zh-Hans', 'ko', 'ja'] as const)
      expect(eastContentRouteOf(locale, TOOLS_HUB_PATHS.east[locale])?.collection).toBe('tools-hub')
    expect(eastEnContentRouteOf('/tools')?.collection).toBe('tools-hub')
    expect(westContentRouteOf('en', '/tools')?.collection).toBe('tools-hub')
    expect(westContentRouteOf('es', '/herramientas')?.collection).toBe('tools-hub')
    // `/tools` 两站各有一页：不算只属于东方站的地址，西方站不 404
    expect(isEastEnglishOnlyPath('/tools')).toBe(false)
    const decide = (host: string, path: string) =>
      routeSite(new URL(`https://${host}${encodeURI(path)}`), templateConfig).kind
    const [east] = templateConfig.sites.east.hosts
    const [west] = templateConfig.sites.west.hosts
    expect(decide(east ?? '', '/tools')).toBe('pass')
    expect(decide(west ?? '', '/tools')).toBe('pass')
    expect(decide(east ?? '', '/zh-hans/工具')).toBe('pass')
    expect(decide(west ?? '', '/es/herramientas')).toBe('pass')
    // 外站语言的枢纽页地址返回本站 404，不跨站
    expect(decide(west ?? '', '/zh-hans/工具')).toBe('not-found')
    expect(decide(east ?? '', '/es/herramientas')).toBe('not-found')
  })

  it.each(HUBS)(
    '%s %s：canonical 指向自身，hreflang 只含本站已有枢纽页的语言，TDK 不写 AI',
    (site, locale) => {
      language.locale = locale
      const head = toolsHubHead(site, locale)
      expect(head).not.toBeNull()
      const origin = `https://${templateConfig.sites[site].hosts[0]}`
      const path = (TOOLS_HUB_PATHS[site] as Record<string, string>)[locale] ?? ''
      const prefix = toolHref(path, locale)
      expect(head?.links.find((link) => link.rel === 'canonical')?.href).toBe(`${origin}${prefix}`)
      const alternates = (head?.links ?? []).flatMap((link) =>
        'hrefLang' in link && link.hrefLang !== 'x-default' ? [link.hrefLang] : [],
      )
      expect([...alternates].sort()).toEqual(Object.keys(TOOLS_HUB_PATHS[site]).sort())
      for (const link of head?.links ?? []) expect(link.href.startsWith(origin)).toBe(true)
      const title = head?.meta.find((item) => 'title' in item)
      const description = head?.meta.find((item) => 'name' in item && item.name === 'description')
      const copy = `${title && 'title' in title ? title.title : ''} ${
        description && 'content' in description ? description.content : ''
      }`
      expect(copy).not.toMatch(/\bAI\b|\bIA\b/)
      expect(copy).toContain(site === 'west' ? 'Arcanumber' : locale === 'en' ? 'Ganjiday' : '')
      expect(JSON.stringify(head?.scripts)).toContain('BreadcrumbList')
    },
  )

  it('进入公开页面清单（站点地图）、预渲染与 llms.txt', () => {
    const content = { posts: [], legal: [], docs: [] }
    for (const [site, locale] of HUBS) {
      const path = (TOOLS_HUB_PATHS[site] as Record<string, string>)[locale]
      const page = publicPages(content, new Date(), templateConfig, site).find(
        (item) => item.path === path && item.locale === locale,
      )
      expect(page, `${site} ${locale}`).toMatchObject({ parent: '/' })
      expect(page?.description.length).toBeGreaterThan(20)
    }
    const entries = prerenderEntryPages(templateConfig).map((entry) => entry.path)
    expect(entries).toEqual(
      expect.arrayContaining([
        '/tools',
        '/en/tools',
        '/zh-hans/工具',
        '/zh-hant/工具',
        '/ko/도구',
        '/ja/ツール',
        '/es/herramientas',
      ]),
    )
    expect(isPrerenderedPath('/tools', templateConfig.i18n.locales)).toBe(true)
    expect(isPrerenderedPath(encodeURI('/zh-hans/工具'), templateConfig.i18n.locales)).toBe(true)
    expect(llmsTxt('east')).toContain(`/zh-hans/${encodeURI('工具')}`)
    expect(llmsTxt('west')).toContain('/tools)')
  })
})
