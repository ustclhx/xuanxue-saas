import { PageWidth, Section, SectionStack } from '@xuanxue/ui/project'
import type { ReactNode } from 'react'
import { type HubFeatured, type HubTool, hubFeatured } from '../marketing/home-hub/featured-data.ts'
import { FeaturedSection } from '../marketing/home-hub/featured-section.tsx'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { ToolFaq } from '../tools/faq.tsx'
import { toolHref } from '../tools/tool-href.ts'
import { eastEnFaq } from './article.tsx'
import { LANDING } from './copy/landing.ts'
import type { LinkKey } from './copy/types.ts'
import { EAST_EN_LINKS, EastEnText } from './links.tsx'

/** 工具卡片已链接的目标：正文段落里只保留锚文本，控制首页正文链接数（每页 2–5 条） */
const CARD_TARGETS = ['bazi', 'ziwei', 'spreads', 'feelings'] as const satisfies readonly LinkKey[]

/** 精选区的工具 id → 本页文案的条目：名称、说明与主卡按钮文字用东方站英文自己的写法 */
const CARD_COPY: Readonly<Record<string, (typeof CARD_TARGETS)[number]>> = {
  bazi: 'bazi',
  ziwei: 'ziwei',
  'tarot-three-card': 'spreads',
  'tarot-card-index': 'feelings',
}

function withLandingCopy(tool: HubTool): HubTool {
  const key = CARD_COPY[tool.id]
  if (!key) return tool
  const { title, summary, action } = LANDING.tools[key]
  return { ...tool, title, summary, action }
}

/** 东方站英文的精选区（content-growth-v2-tools 决策 5）：与其他语言首页同一份选择，文案换成本页的 */
export function eastEnFeatured(base: HubFeatured = hubFeatured('east', 'en')): HubFeatured {
  return {
    ...base,
    main: base.main && withLandingCopy(base.main),
    secondary: base.secondary.map(withLandingCopy),
  }
}

/**
 * 东方站根路径英文落地页（openspec add-locales-eu-ja 5b）：东方站英文发布后取代 `/` 的英文入口页。
 * 沿用两站落地页的版式角色（品牌主视觉 → 精选区 → 说明 → FAQ，home-hub/landing-page.tsx），
 * 不新增页面类型；文案来自 copy/landing.ts，只由本组件引用，不进其他首页的包。
 * 首屏唯一主按钮指向八字计算器（转化入口，不计正文内链）。
 */
export function EastEnLanding({
  art,
  mainVisual,
  featured = eastEnFeatured(),
}: {
  art?: ReactNode
  /** 精选区主卡右侧的样例图形（四柱），由首页路由传入 */
  mainVisual?: ReactNode
  featured?: HubFeatured
}) {
  return (
    <SectionStack data-landing>
      <section aria-labelledby="landing-title" data-landing-block="hero">
        <PageWidth className="flex flex-col-reverse gap-6 pt-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pt-18">
          <div className="flex max-w-150 flex-col gap-4 lg:gap-5">
            <p className="m-0 text-caption text-ink-subtle">{LANDING.eyebrow}</p>
            <h1 id="landing-title" className="m-0 text-balance font-heading text-display text-ink">
              {LANDING.h1}
            </h1>
            <p className="m-0 text-ink-muted text-lead">{LANDING.lead}</p>
            <div className="mt-3">
              <a
                href={toolHref(EAST_EN_LINKS.bazi, 'en')}
                data-landing-cta
                data-link-zone="action"
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-brand px-7 font-medium text-body text-on-brand no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3"
              >
                {LANDING.cta}
              </a>
            </div>
          </div>
          <div
            aria-hidden="true"
            data-landing-art
            className="size-42 shrink-0 self-center lg:size-80"
          >
            {art}
          </div>
        </PageWidth>
      </section>
      <FeaturedSection
        featured={featured}
        site="east"
        title={LANDING.toolsTitle}
        intro={LANDING.toolsIntro}
        mainVisual={mainVisual}
      />
      {LANDING.sections.map((section, index) => (
        <Section
          key={section.heading}
          id={`about-${index + 1}`}
          data-landing-block="about"
          title={section.heading}
        >
          <div className="flex max-w-180 flex-col gap-4">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="m-0 text-body text-ink-muted">
                <EastEnText text={paragraph} plain={CARD_TARGETS} />
              </p>
            ))}
          </div>
        </Section>
      ))}
      <Section id="faq" data-landing-block="faq">
        <div className="flex flex-col gap-6">
          <ToolFaq title={LANDING.faqTitle} items={eastEnFaq(LANDING.faq)} />
          <Disclaimer />
        </div>
      </Section>
    </SectionStack>
  )
}
