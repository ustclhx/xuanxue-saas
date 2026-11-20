import { PageWidth, Section, SectionStack } from '@xuanxue/ui/project'
import type { ReactNode } from 'react'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { ToolFaq } from '../tools/faq.tsx'
import { toolHref } from '../tools/tool-href.ts'
import { eastEnFaq } from './article.tsx'
import { LANDING } from './copy/landing.ts'
import type { LinkKey } from './copy/types.ts'
import { EAST_EN_LINKS, EastEnText } from './links.tsx'

/** 工具卡片已链接的目标：正文段落里只保留锚文本，控制首页正文链接数（每页 2–5 条） */
const CARD_TARGETS = ['bazi', 'ziwei', 'spreads', 'feelings'] as const satisfies readonly LinkKey[]

/**
 * 东方站根路径英文落地页（openspec add-locales-eu-ja 5b）：东方站英文发布后取代 `/` 的英文入口页。
 * 沿用两站落地页的版式角色（品牌主视觉 → 工具入口 → 说明 → FAQ，home-hub/landing-page.tsx），
 * 不新增页面类型；文案来自 copy/landing.ts，只由本组件引用，不进其他首页的包。
 * 首屏唯一主按钮指向八字计算器（转化入口，不计正文内链）。
 */
export function EastEnLanding({ art }: { art?: ReactNode }) {
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
      <Section
        id="tools"
        data-landing-block="tools"
        title={LANDING.toolsTitle}
        intro={LANDING.toolsIntro}
      >
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {CARD_TARGETS.map((key) => {
            const tool = LANDING.tools[key]
            return (
              <li
                key={key}
                className="relative flex w-full flex-col gap-1 rounded-object bg-surface px-6 py-5 text-ink transition-colors hover:bg-surface-2 sm:gap-2.5 sm:p-7"
              >
                <h3 className="m-0 font-heading text-ink text-subtitle">
                  <a
                    href={toolHref(EAST_EN_LINKS[key], 'en')}
                    data-tool={key}
                    className="text-ink no-underline after:absolute after:inset-0 after:rounded-object focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:outline-offset-3"
                  >
                    {tool.title}
                  </a>
                </h3>
                <p className="m-0 text-body text-ink-muted">{tool.summary}</p>
                <span
                  aria-hidden="true"
                  className="mt-auto text-body text-brand-ink underline underline-offset-4"
                >
                  {tool.action}
                </span>
              </li>
            )
          })}
        </ul>
      </Section>
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
