import { cn } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { useSiteId } from '../../site/context.tsx'
import { AiDisclaimer } from '../../tools/disclaimer.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import type { PricingCatalog } from '../pricing-data.ts'
import { pricingSnapshot } from '../pricing-snapshot.ts'
import { dailyEntryHref, type HubPrice, type HubTool, hubPricing, hubTools } from './data.ts'
import { HUB_SAMPLE_PARAGRAPHS, HUB_SAMPLE_SECTIONS, isHubSampleLocale } from './sample.ts'

// 两站首页枢纽区块（openspec redesign-home-chart-visuals tasks 9.2–9.4；设计稿副本
// docs/design/prototypes/roadmap/Main.dc.html、HomeWest.dc.html、HomeMobile.dc.html）：
// 位于工具区（H1、表单、结果、说明）之后、FAQ 之前，依次为每日运势入口、工具矩阵、样例详批、三步流程、
// 定价入口与信任背书。全部为静态内容，可构建期预渲染，不引入客户端状态，不查库。
// 免费工具相关文案不写 AI；只有样例详批、三步中的详批一步与定价入口属于 AI 详批语境，并附 AI 声明。

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const sectionTitle = 'm-0 font-heading font-semibold text-2xl text-ink sm:text-3xl'

export function HomeHub({
  sampleChart,
  catalog = pricingSnapshot,
}: {
  /** 样例命盘图形（东方站四柱、西方站灵数推导），由首页按站点传入，避免两站互相打包对方的图形 */
  sampleChart?: ReactNode
  catalog?: PricingCatalog
}) {
  const site = useSiteId()
  const locale = getLocale()
  const tools = hubTools(site, locale)
  const prices = hubPricing(catalog, locale)
  const daily = dailyEntryHref(locale)
  return (
    <section
      data-home-hub
      aria-label={m.home_hub_label()}
      className="flex flex-col gap-14 sm:gap-16"
    >
      {daily && <DailyEntry href={daily} />}
      <ToolMatrix tools={tools} numerals={site === 'west' ? 'roman' : 'arabic'} />
      {isHubSampleLocale(locale) && (
        <SampleReading
          sections={HUB_SAMPLE_SECTIONS[locale]}
          paragraph={HUB_SAMPLE_PARAGRAPHS[locale]}
          chart={sampleChart}
        />
      )}
      <HubSteps />
      <PlansEntry prices={prices} pricingHref={toolHref('/pricing', locale)} />
      <TrustFacts />
    </section>
  )
}

/** 每日运势入口：只有公开每日运势页已登记时渲染，内容为静态文案与链接，不在首页计算个人运势 */
function DailyEntry({ href }: { href: string }) {
  return (
    <section
      aria-labelledby="hub-daily"
      data-hub-block="daily"
      className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 sm:gap-6 sm:px-6 sm:py-5"
    >
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
        <h2 id="hub-daily" className="m-0 font-semibold text-base text-ink sm:text-lg">
          {m.home_hub_daily_title()}
        </h2>
        <p className="m-0 text-ink-muted text-sm sm:text-base">{m.home_hub_daily_desc()}</p>
      </div>
      <a
        href={href}
        className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 font-semibold text-ink hover:border-ink-subtle"
      >
        {m.home_hub_daily_cta()}
      </a>
    </section>
  )
}

function ToolMatrix({ tools, numerals }: { tools: HubTool[]; numerals: 'roman' | 'arabic' }) {
  if (tools.length === 0) return null
  return (
    <section aria-labelledby="hub-tools" data-hub-block="tools" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 id="hub-tools" className={sectionTitle}>
          {m.home_hub_tools_title()}
        </h2>
        <p className="m-0 text-ink-muted">{m.home_hub_tools_intro()}</p>
      </div>
      <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {tools.map((tool, index) => (
          <li key={tool.id} className="flex">
            <a
              href={tool.href}
              data-tool={tool.id}
              className="flex w-full items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-ink no-underline transition-colors hover:border-line-strong sm:flex-col sm:items-start sm:gap-2.5 sm:p-5"
            >
              <span aria-hidden="true" className="w-7 shrink-0 font-heading text-brand-ink">
                {numerals === 'roman'
                  ? (ROMAN[index] ?? String(index + 1))
                  : String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <strong className="font-semibold text-base sm:text-lg">{tool.title}</strong>
                <span className="text-ink-muted text-sm leading-relaxed">{tool.summary}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 样例详批：虚构样例命盘图形 + 章节大纲（与 catalog 默认提示词一致）+「示例」标记 + AI 声明。
 * 样例段落经使用者审定前不渲染（readings/samples.ts 的 SAMPLES_APPROVED 为 false 时 HUB_SAMPLE_PARAGRAPHS 为空）；不调用模型、不引用访客数据。
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
    <section
      aria-labelledby="hub-sample"
      data-hub-block="sample"
      className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8"
    >
      <figure className="m-0 flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-ink">{m.home_hub_sample_chart_title()}</strong>
          <span
            data-sample-badge
            className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-ink-muted text-xs"
          >
            {m.chart_sample_badge()}
          </span>
        </div>
        {chart}
        <figcaption className="text-ink-subtle text-sm">{m.home_hub_sample_caption()}</figcaption>
      </figure>
      <div className="flex flex-col gap-4">
        <h2 id="hub-sample" className={sectionTitle}>
          {m.home_hub_sample_heading()}
        </h2>
        <p className="m-0 text-ink-muted">{m.home_hub_sample_intro({ count: sections.length })}</p>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-6 text-ink-muted leading-relaxed">
          {sections.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ol>
        {paragraph && (
          <blockquote
            data-sample-paragraph
            className="m-0 flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-4 text-ink leading-relaxed"
          >
            <span className="text-ink-subtle text-xs">{m.home_hub_sample_paragraph_label()}</span>
            {paragraph}
          </blockquote>
        )}
        <AiDisclaimer />
        {/* 回到页首的排盘 / 计算表单（MarketingShell 的 main#main） */}
        <a
          href="#main"
          className="inline-flex min-h-12 items-center self-start rounded-lg bg-brand px-5 font-semibold text-on-brand hover:opacity-90"
        >
          {m.home_hub_sample_cta()}
        </a>
      </div>
    </section>
  )
}

function HubSteps() {
  const steps = [
    [m.home_hub_step1_title(), m.home_hub_step1_desc()],
    [m.home_hub_step2_title(), m.home_hub_step2_desc()],
    [m.home_hub_step3_title(), m.home_hub_step3_desc()],
  ] as const
  return (
    <section aria-labelledby="hub-steps" data-hub-block="steps" className="flex flex-col gap-5">
      <h2 id="hub-steps" className={sectionTitle}>
        {m.home_hub_steps_title()}
      </h2>
      {/* biome-ignore lint/a11y/noRedundantRoles: list-none 会让 Safari 读屏丢失列表语义，需显式声明 */}
      <ol role="list" className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {steps.map(([title, description], index) => (
          <li
            key={title}
            className={cn(
              'flex flex-col gap-2 border-t-2 px-1 pt-4 md:px-5 md:pt-5',
              index === 0 ? 'border-brand' : 'border-line-strong',
            )}
          >
            <strong className="text-ink">
              <span aria-hidden="true" className="mr-3 font-heading text-brand-ink">
                {index + 1}
              </span>
              {title}
            </strong>
            <p className="m-0 text-ink-muted leading-relaxed">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** 定价入口：与定价页同一份构建期快照；没有可购买方案时只写免费说明与定价页链接，不出现金额 */
function PlansEntry({ prices, pricingHref }: { prices: HubPrice[]; pricingHref: string }) {
  return (
    <section
      aria-labelledby="hub-plans"
      data-hub-block="plans"
      className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-surface p-5 sm:gap-8 sm:p-7"
    >
      <div className="flex min-w-0 flex-1 basis-72 flex-col gap-2">
        <h2 id="hub-plans" className="m-0 font-heading font-semibold text-2xl text-ink">
          {m.home_hub_plans_title()}
        </h2>
        <p className="m-0 text-ink-muted leading-relaxed">
          {prices.length ? m.home_hub_plans_desc() : m.home_hub_plans_free()}
        </p>
      </div>
      {prices.length > 0 && (
        <dl
          aria-label={m.home_hub_plans_label()}
          className="m-0 grid min-w-0 flex-2 basis-96 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
        >
          {prices.map((plan) => (
            <div
              key={plan.key}
              data-plan={plan.key}
              className="flex flex-col gap-0.5 rounded-lg bg-surface-2 p-3 sm:p-4"
            >
              <dt className="text-ink-subtle text-sm">{plan.name}</dt>
              <dd className="m-0 font-semibold text-ink text-xl tabular-nums">
                {plan.price}
                {plan.reference && (
                  <span className="ml-1 font-normal text-ink-subtle text-sm">
                    ≈ {plan.reference}
                  </span>
                )}
              </dd>
              <dd className="m-0 text-ink-muted text-sm">
                {m.home_hub_plans_credits({ count: plan.credits })}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <a
        href={pricingHref}
        className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 font-semibold text-ink hover:border-ink-subtle"
      >
        {m.home_hub_plans_cta()}
      </a>
    </section>
  )
}

/** 信任背书：只列可核实的事实；没有带来源与统计日期的数值，因此不渲染数值条（模板 Stats） */
function TrustFacts() {
  const facts = [
    m.home_hub_trust_1(),
    m.home_hub_trust_2(),
    m.home_hub_trust_3(),
    m.home_hub_trust_4(),
  ]
  return (
    <section aria-labelledby="hub-trust" data-hub-block="trust" className="flex flex-col gap-4">
      <h2 id="hub-trust" className="m-0 font-heading font-semibold text-2xl text-ink">
        {m.home_hub_trust_title()}
      </h2>
      <ul className="m-0 grid list-disc gap-x-8 gap-y-2 pl-5 text-ink-muted leading-relaxed sm:grid-cols-2">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </section>
  )
}
