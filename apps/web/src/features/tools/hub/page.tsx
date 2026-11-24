import type { SiteId } from '@xuanxue/config'
import {
  HubGroup,
  HubGroups,
  HubLinkList,
  HubToc,
  HubToolGrid,
  PageWidth,
  ToolCard,
  ToolLabel,
} from '@xuanxue/ui/project'
import { type ComponentProps, Fragment, type ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { Breadcrumb } from '../breadcrumb.tsx'
import { BUILD_DATE } from '../build-date.ts'
import { type DirectoryEntry, directoryGroups, siteTools } from '../directory.ts'
import { Disclaimer } from '../disclaimer.tsx'
import { inlineLinkClass } from '../inline-links.tsx'
import { MAIN_TOOL_IDS, TOOL_ROUTES, type ToolRoute } from '../registry.ts'
import { toolHref } from '../tool-href.ts'
import { badgeText, freeLabelText, groupCopy, toolGlyph, toolSummary, toolTitle } from './copy.ts'
import { TOOLS_HUB_TITLES } from './routes.ts'

/** 导语里从现成句子链接出去的第二个工具：两站各语言都有三张牌塔罗 */
const START_SECOND = 'tarot-three-card'

/**
 * 「全部工具」枢纽页（openspec content-growth-v2-tools 决策 5，specs/tool-directory；设计稿
 * docs/design/prototypes/content-growth-v2-tools/HubEast.dc.html、HubWest.dc.html、HubEmpty.dc.html）：
 * 面包屑、H1、说明 → 分组跳转 → 各分组（工具卡；知识库为链接列表）→ 合规声明。
 * 全部来自工具注册表，服务端渲染、构建期预渲染，不查库；每个入口是真实的 `<a>`，禁用脚本时同样完整。
 * 没有条目的分组连同它的跳转标签都不渲染。卡片只标动作式免费标签与小标：不写 AI，不标付费。
 *
 * 链接区域（docs/seo-internal-linking.md §3）：分组里的工具卡与链接列表是目录式的模板区块（`related`，
 * 锚文本固定取目标页主词），不计入正文内链与锚文本统计；说明里的两条句内链接是正文链接。
 */
export function ToolsHubPage({
  site,
  locale,
  routes = TOOL_ROUTES,
  today = BUILD_DATE,
}: {
  site: SiteId
  locale: string
  routes?: readonly ToolRoute[]
  today?: string
}) {
  const groups = directoryGroups(site, locale, routes, today)
  const tools = siteTools(site, locale, routes, today)
  const title = TOOLS_HUB_TITLES[locale] ?? m.tools_hub_title()
  const link = (tool: DirectoryEntry | undefined, key: string): ReactNode =>
    tool ? (
      <a
        key={key}
        href={toolHref(tool.path, locale)}
        data-tool={tool.id}
        className={inlineLinkClass}
      >
        {toolTitle(tool, site, locale)}
      </a>
    ) : null
  const main = link(tools.get(MAIN_TOOL_IDS[site]), 'main')
  const second = link(tools.get(START_SECOND), 'second')
  const start = site === 'east' ? m.tools_hub_start_east : m.tools_hub_start_west
  return (
    <MarketingShell freeTools>
      <PageWidth data-tools-hub={site} className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
        <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
          <Breadcrumb
            items={[{ name: m.marketing_nav_home(), href: toolHref('/', locale) }, { name: title }]}
          />
          <h1 className="m-0 text-balance font-heading text-ink text-title">{title}</h1>
          <p className="m-0 text-body text-ink-muted">
            {site === 'east' ? m.tools_hub_intro_east() : m.tools_hub_intro_west()}
          </p>
          {main && second && (
            <p data-hub-start className="m-0 text-body text-ink-muted">
              {withLinks(start({ main: MARK.main, tarot: MARK.tarot }), { main, tarot: second })}
            </p>
          )}
        </header>
        {groups.length > 1 && (
          <HubToc
            label={m.tools_hub_groups_label()}
            items={groups.map(({ group }) => ({
              href: `#${groupId(group)}`,
              label: groupCopy(group).title,
            }))}
          />
        )}
        <HubGroups>
          {groups.map(({ group, tools: members }) => {
            const copy = groupCopy(group)
            return (
              <HubGroup key={group} id={groupId(group)} title={copy.title} intro={copy.intro}>
                {group === 'knowledge' ? (
                  <HubLinkList
                    data-link-zone="related"
                    items={members.map((tool) => ({
                      id: tool.id,
                      href: toolHref(tool.path, locale),
                      label: toolTitle(tool, site, locale),
                    }))}
                  />
                ) : (
                  <HubToolGrid data-link-zone="related">
                    {members.map((tool) => {
                      const name = toolTitle(tool, site, locale)
                      const badge = badgeText(tool.badge)
                      const label = freeLabelText(tool.freeLabel)
                      return (
                        <ToolCard
                          key={tool.id}
                          layout="row"
                          href={toolHref(tool.path, locale)}
                          title={name}
                          glyph={toolGlyph(tool, name, locale)}
                          summary={toolSummary(tool, site, locale)}
                          badge={badge && <ToolLabel kind="new">{badge}</ToolLabel>}
                          labels={label && <ToolLabel kind="free">{label}</ToolLabel>}
                          linkProps={{ 'data-tool': tool.id } as ComponentProps<'a'>}
                        />
                      )
                    })}
                  </HubToolGrid>
                )}
              </HubGroup>
            )
          })}
        </HubGroups>
        <Disclaimer />
      </PageWidth>
    </MarketingShell>
  )
}

const groupId = (group: string) => `group-${group}`

/** 文案里的链接位置：先填入占位记号，再按记号切开，换成真实链接（锚文本取工具名，与卡片一致） */
const MARK = { main: '\u0001main\u0001', tarot: '\u0001tarot\u0001' } as const

function withLinks(text: string, links: Readonly<Record<string, ReactNode>>): ReactNode {
  return text.split('\u0001').map((part, index) =>
    index % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: 句子片段顺序固定
      <Fragment key={index}>{links[part]}</Fragment>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: 句子片段顺序固定
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}
