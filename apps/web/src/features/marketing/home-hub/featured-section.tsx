import type { SiteId } from '@xuanxue/config'
import {
  FeaturedMain,
  FeaturedSeason,
  FeaturedSeasonLink,
  FeaturedTools,
  Section,
  ToolCard,
  ToolLabel,
} from '@xuanxue/ui/project'
import type { ComponentProps, ReactNode } from 'react'
import type { HubFeatured } from './featured-data.ts'
import { TodayLines } from './today-strip.tsx'

const textLink = 'inline-flex min-h-11 items-center text-body text-brand-ink hover:decoration-2'

/**
 * 精选区（openspec content-growth-v2-tools 决策 5；设计稿 content-growth-v2-tools/Main.dc.html、HomeWest.dc.html、
 * HomeEastKo.dc.html）：主卡 + 季节位 + 副卡，下方一行「全部工具」链接。每张卡是一个真实链接（链接只包住工具名，
 * 锚文本 = 目标页主词，openspec seo-fix-tdk-links 决策 5）；入口卡只标动作式免费标签与「新」「2027」小标，不写 AI、不标付费。
 * 季节位在 12-01 至次年 2 月末放当季年份内容，其余日期（或当季内容尚未上线时）放每日运势入口并带当日一行。
 */
export function FeaturedSection({
  featured,
  site,
  title,
  intro,
  mainVisual,
}: {
  featured: HubFeatured
  site: SiteId
  title: string
  intro: string
  mainVisual?: ReactNode
}) {
  const { main, season, secondary, hub } = featured
  if (!main) return null
  return (
    <Section id="tools" data-landing-block="tools" title={title} intro={intro}>
      <FeaturedTools
        count={secondary.length}
        main={
          <FeaturedMain
            href={main.href}
            title={main.title}
            summary={main.summary}
            action={main.action}
            visual={mainVisual}
            label={main.label && <ToolLabel kind="free">{main.label}</ToolLabel>}
            linkProps={{ 'data-tool': main.id } as ComponentProps<'a'>}
          />
        }
        season={
          season && (
            <FeaturedSeason
              data-season={season.kind}
              badge={season.badge && <ToolLabel kind="new">{season.badge}</ToolLabel>}
              mark={season.mark}
              lead={season.kind === 'daily' && <TodayLines site={site} className="flex flex-col" />}
              title={season.title}
              summary={season.summary}
            >
              <FeaturedSeasonLink
                variant="button"
                href={season.primary.href}
                data-tool={season.primary.id}
              >
                {season.primary.label}
              </FeaturedSeasonLink>
              {season.secondary && (
                <FeaturedSeasonLink href={season.secondary.href} data-tool={season.secondary.id}>
                  {season.secondary.label}
                  <span aria-hidden="true">&nbsp;→</span>
                </FeaturedSeasonLink>
              )}
            </FeaturedSeason>
          )
        }
      >
        {secondary.map((tool) => (
          <ToolCard
            key={tool.id}
            href={tool.href}
            title={tool.title}
            glyph={tool.glyph}
            summary={tool.summary}
            badge={tool.badge && <ToolLabel kind="new">{tool.badge}</ToolLabel>}
            labels={tool.label && <ToolLabel kind="free">{tool.label}</ToolLabel>}
            linkProps={{ 'data-tool': tool.id } as ComponentProps<'a'>}
          />
        ))}
      </FeaturedTools>
      {hub && (
        <p className="m-0 mt-4">
          <a href={hub.href} data-tool="tools-hub" className={textLink}>
            {hub.label}
            <span aria-hidden="true">&nbsp;→</span>
          </a>
        </p>
      )}
    </Section>
  )
}
