import { Section, SectionStack } from '@xuanxue/ui/project'
import type { ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { useSiteId } from '../../site/context.tsx'
import { AiDisclaimer } from '../../tools/disclaimer.tsx'
import { mainToolHref, toolHref } from '../../tools/tool-href.ts'
import type { PricingCatalog } from '../pricing-data.ts'
import { pricingSnapshot } from '../pricing-snapshot.ts'
import {
  DAILY_PAGES,
  dailyEntryHref,
  type HubPriceLine,
  type HubTool,
  hubMoreTool,
  hubPriceLine,
  hubTools,
} from './data.ts'
import { LandingHero, SAMPLE_ANCHOR } from './hero.tsx'
import { HUB_SAMPLE_PARAGRAPHS, HUB_SAMPLE_SECTIONS, isHubSampleLocale } from './sample.ts'
import { TodayStrip } from './today-strip.tsx'

// 两站品牌落地页（openspec separate-landing-homepage design.md D2、D2a，specs/home-hub「品牌落地页结构」；
// 设计稿副本 docs/design/prototypes/warm-refresh/Main.dc.html、LandingWest.dc.html、LandingKoMobile.dc.html）。
// 区块顺序：品牌主视觉 → 3–4 个工具入口 → 样例报告 → 今日条 → 三步说明 → 一行价格 → 信任说明 → 品牌级 FAQ。
// 首页不含工具表单、结果区、工具专属 FAQ 与说明长文；每个工具在首页只链接一次。
// 除今日条在浏览器内填入当日信息外全部为静态内容：构建期预渲染，不查库。
// 免费工具相关文案不写 AI；只有样例详批、三步中的详批一步与一行价格属于 AI 详批语境，样例附 AI 声明。

const textLink = 'inline-flex min-h-11 items-center text-body text-brand-ink hover:decoration-2'

export function LandingPage({
  art,
  sampleChart,
  catalog = pricingSnapshot,
  dailyPages = DAILY_PAGES,
}: {
  /** 首屏线描插画，由首页路由按站点传入；不传时保留同样大小的空位 */
  art?: ReactNode
  /** 样例命盘（东方站四柱、西方站数字环），由首页路由按站点传入，避免两站互相打包对方的图形 */
  sampleChart?: ReactNode
  catalog?: PricingCatalog
  /** 每日运势公开页登记表；当前语言未登记时不渲染今日条 */
  dailyPages?: Readonly<Partial<Record<string, string>>>
}) {
  const site = useSiteId()
  const locale = getLocale()
  const daily = dailyEntryHref(locale, dailyPages)
  return (
    <SectionStack data-landing>
      <LandingHero toolHref={mainToolHref(locale)} art={art} />
      <FeaturedTools tools={hubTools(site, locale)} more={hubMoreTool(site, locale)} />
      {isHubSampleLocale(locale) && (
        <SampleReading
          sections={HUB_SAMPLE_SECTIONS[locale]}
          paragraph={HUB_SAMPLE_PARAGRAPHS[locale]}
          chart={sampleChart}
        />
      )}
      {daily && <TodayStrip site={site} href={daily} />}
      <LandingSteps />
      <PriceLine line={hubPriceLine(catalog, locale)} href={toolHref('/pricing', locale)} />
      <TrustFacts />
      <BrandFaq />
    </SectionStack>
  )
}

/** 精选工具入口：整张卡片可点（链接只包住工具名），字形用站点强调色并对读屏隐藏 */
function FeaturedTools({ tools, more }: { tools: HubTool[]; more: { href: string } | null }) {
  if (tools.length === 0) return null
  return (
    <Section
      id="tools"
      data-landing-block="tools"
      title={m.landing_tools_title()}
      intro={m.home_hub_tools_intro()}
    >
      <ul
        className={
          tools.length === 4
            ? 'm-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6'
            : 'm-0 grid list-none gap-4 p-0 sm:grid-cols-3 lg:gap-6'
        }
      >
        {tools.map((tool) => (
          <li
            key={tool.id}
            className="relative flex w-full gap-3 rounded-object bg-surface px-6 py-5 text-ink transition-colors hover:bg-surface-2 sm:flex-col sm:gap-2.5 sm:p-7"
          >
            <span
              aria-hidden="true"
              className="w-11 shrink-0 font-heading text-mark text-title sm:w-auto"
            >
              {tool.glyph}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-2.5">
              {/* 链接只包住工具名（锚文本 = 目标页主词，openspec seo-fix-tdk-links 决策 5），
                  伪元素铺满卡片：整张卡仍可点，焦点环画在卡片外沿 */}
              <h3 className="m-0 font-heading text-ink text-subtitle">
                <a
                  href={tool.href}
                  data-tool={tool.id}
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
            </div>
          </li>
        ))}
      </ul>
      {more && (
        <p className="m-0 mt-4">
          <a href={more.href} className={textLink}>
            {m.landing_more_tool_link()}
          </a>
        </p>
      )}
    </Section>
  )
}

/**
 * 样例报告：虚构样例命盘 + 章节大纲（与 catalog 默认提示词一致）+ 标明「示例」的段落，下方附 AI 声明。
 * 段落经使用者审定前不渲染（readings/samples.ts 的 SAMPLES_APPROVED）；不调用模型、不引用访客数据。
 * 不放按钮：工具入口已在上方，每个工具在首页只链接一次。
 */
function SampleReading({
  sections,
  paragraph,
  chart,
}: {
  sections: readonly string[]
  paragraph: string | undefined
  chart: ReactNode
}) {
  return (
    <Section
      id={SAMPLE_ANCHOR}
      data-landing-block="sample"
      title={m.home_hub_sample_heading()}
      intro={m.home_hub_sample_intro({ count: sections.length })}
      className="scroll-mt-6"
    >
      <div className="grid gap-7 rounded-object bg-surface p-6 sm:p-8 lg:grid-cols-12 lg:gap-14">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <h3 className="m-0 font-heading text-ink text-subtitle">
            {m.home_hub_sample_chart_title()}
          </h3>
          {chart}
          <p className="m-0 text-caption text-ink-subtle">{m.home_hub_sample_caption()}</p>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-7">
          <h3 className="m-0 font-heading text-ink text-subtitle">
            {m.landing_sample_outline_title()}
          </h3>
          <ol className="m-0 grid list-none grid-cols-2 gap-x-6 p-0">
            {sections.map((section, index) => (
              <li
                key={section}
                className="flex items-baseline gap-2.5 border-line border-b py-1.5 text-body text-ink"
              >
                <span aria-hidden="true" className="text-caption text-ink-subtle tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section}
              </li>
            ))}
          </ol>
          {paragraph && (
            <>
              <p data-sample-badge className="m-0 text-caption text-ink-subtle">
                {m.home_hub_sample_paragraph_label()}
              </p>
              <p data-sample-paragraph className="m-0 text-body text-ink-muted">
                {paragraph}
              </p>
            </>
          )}
        </div>
      </div>
      <AiDisclaimer className="mt-4" />
    </Section>
  )
}

function LandingSteps() {
  const steps = [
    [m.landing_step_mark_1(), m.home_hub_step1_title(), m.home_hub_step1_desc()],
    [m.landing_step_mark_2(), m.home_hub_step2_title(), m.home_hub_step2_desc()],
    [m.landing_step_mark_3(), m.home_hub_step3_title(), m.home_hub_step3_desc()],
  ] as const
  return (
    <Section id="how-it-works" data-landing-block="steps" title={m.home_hub_steps_title()}>
      {/* biome-ignore lint/a11y/noRedundantRoles: list-none 会让 Safari 读屏丢失列表语义，需显式声明 */}
      <ol role="list" className="m-0 grid list-none gap-6 p-0 sm:grid-cols-3 sm:gap-12">
        {steps.map(([mark, title, description]) => (
          <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
            {/* 序号由有序列表语义表达，大号数字只作视觉 */}
            <span
              aria-hidden="true"
              className="w-11 shrink-0 font-heading text-ink-subtle text-title sm:w-auto"
            >
              {mark}
            </span>
            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
              <h3 className="m-0 font-heading text-ink text-subtitle">{title}</h3>
              <p className="m-0 text-body text-ink-muted">{description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/**
 * 一行价格：免费工具 + 每份详批积分数 + 每日登录赠送积分数，链接到定价页；不显示套餐与金额。
 * 当前语言没有可购买的方案时只写免费说明，不出现数字。
 */
function PriceLine({ line, href }: { line: HubPriceLine | null; href: string }) {
  return (
    <Section
      id="pricing"
      tone="band"
      aria-label={m.landing_price_label()}
      data-landing-block="price"
    >
      <p className="m-0 text-body text-ink">
        {line === null
          ? m.home_hub_plans_free()
          : line.dailyCredits === null
            ? m.landing_price_line_no_daily({ reading: line.readingCredits })
            : line.firstLoginCredits === null
              ? m.landing_price_line_daily({
                  reading: line.readingCredits,
                  daily: line.dailyCredits,
                })
              : m.landing_price_line({
                  reading: line.readingCredits,
                  first: line.firstLoginCredits,
                  daily: line.dailyCredits,
                })}
      </p>
      <a href={href} className={`${textLink} shrink-0`}>
        {m.landing_price_cta()}
      </a>
    </Section>
  )
}

/** 信任说明：只列可核实的事实，属于免费区，不写 AI */
function TrustFacts() {
  const facts = [
    m.home_hub_trust_1(),
    m.home_hub_trust_2(),
    m.home_hub_trust_3(),
    m.home_hub_trust_4(),
  ]
  return (
    <Section id="trust" data-landing-block="trust" title={m.home_hub_trust_title()}>
      <ul className="m-0 grid max-w-240 list-none gap-4 p-0 sm:grid-cols-2 sm:gap-x-16 sm:gap-y-5">
        {facts.map((fact) => (
          <li key={fact} className="flex gap-3.5 text-body text-ink-muted">
            <span aria-hidden="true" className="mt-2.75 size-1.5 shrink-0 rounded-full bg-illus" />
            {fact}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/**
 * 品牌级 FAQ：三条取自定价页现有问答（design.md D2a），原生 details / summary，无需脚本即可展开。
 * 首页不输出 FAQPage 结构化数据（工具专属 FAQ 与 FAQPage 在工具页）。
 */
function BrandFaq() {
  const items = [
    [m.pricing_faq_free_q(), m.pricing_faq_free_a()],
    [m.pricing_faq_accuracy_q(), m.pricing_faq_accuracy_a()],
    [m.pricing_faq_pay_q(), m.pricing_faq_pay_a()],
  ] as const
  return (
    <Section id="faq" data-landing-block="faq" title={m.pricing_faq_title()}>
      <div className="max-w-180 border-line border-t">
        {items.map(([question, answer], index) => (
          <details key={question} open={index === 0} className="group border-line border-b">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-body text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
              {question}
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="size-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
              >
                <path
                  d="M5 8l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <p className="m-0 pb-5 text-body text-ink-muted">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}
