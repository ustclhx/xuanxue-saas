import { Badge, cn, LinkCard } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useId, useMemo } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolContext } from '../../tools/context.tsx'
import { Disclaimer } from '../../tools/disclaimer.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import {
  ANGEL_COPY,
  digitsSummary,
  digitTheme,
  hubRelated,
  numberRelated,
  patternText,
  type RelatedCard,
  sumText,
} from './copy.ts'
import type { AngelGridItem } from './listing.ts'
import { type AngelGroup, angelFacts, angelGroup } from './numbers.ts'
import type { AngelNumberPageData } from './page.functions.ts'
import { ANGEL_HUB_PATHS, type AngelLocale, angelNumberPath } from './paths.ts'

/**
 * angel numbers 枢纽与数字页（设计稿 docs/design/prototypes/content-growth-v2-batch2/AngelHub、AngelNumber，
 * 使用者 2026-11-24 确认；ProposalsB A5「数字格加副文字与当前态」、B9「枢纽分组、只列已发布、无查询框」）。
 * 只用 @xuanxue/ui 组件与设计 token。数字事实由 numbers.ts 按生命灵数约简规则计算，正文来自内容集合。
 * 组内相似度按 H2 段测量：计算步骤与数字格所在的段标 data-table-section（只报告），数字标 data-locale-fixed。
 */

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'

function Shell({ tool, children }: { tool: string; children: ReactNode }) {
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">{children}</PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

function PageHeader({
  locale,
  breadcrumb,
  current,
  heading,
  lede,
  badge,
}: {
  locale: AngelLocale
  breadcrumb: readonly PageLink[]
  current: string
  heading: string
  lede: string
  badge?: string | undefined
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      <Breadcrumb
        items={[
          ...breadcrumb.map((item) => ({ name: item.label, href: toolHref(item.href, locale) })),
          { name: current },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-balance font-heading text-ink text-title">{heading}</h1>
        {badge && <Badge size="compact">{badge}</Badge>}
      </div>
      <p className="m-0 text-body text-ink-muted">{lede}</p>
    </header>
  )
}

function ProseSection({ title, html }: { title: string; html: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex max-w-180 flex-col gap-5">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <RichContent html={html} />
    </section>
  )
}

/**
 * 数字格（ProposalsB A5）：每格一个数字加一行主题副文字，当前数字用 1px 强调色内框。
 * 链接属于模板区块（`zone`），不计正文内链；数字是固定事实（data-locale-fixed）。
 */
function NumberGrid({
  items,
  hrefOf,
  current,
  columns = 'wide',
  label,
}: {
  items: readonly { key: string; label: string; caption?: string | undefined }[]
  hrefOf: (key: string) => string
  current?: string | undefined
  columns?: 'wide' | 'nine'
  label?: string | undefined
}) {
  return (
    <ul
      aria-label={label}
      data-locale-fixed
      className={cn(
        'm-0 grid list-none gap-2 p-0',
        columns === 'nine'
          ? 'max-w-190 grid-cols-3 sm:grid-cols-9'
          : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
      )}
    >
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0">
          <a
            href={hrefOf(item.key)}
            aria-current={item.key === current ? 'page' : undefined}
            className={cn(
              'flex w-full flex-col items-center justify-center rounded-field bg-surface px-1 py-2 text-center text-ink no-underline transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-[current=page]:ring-1 aria-[current=page]:ring-mark aria-[current=page]:ring-inset',
              item.caption ? 'min-h-18' : 'min-h-14',
            )}
          >
            <span className="font-bold font-heading text-subtitle">{item.label}</span>
            {item.caption && <span className="text-caption text-ink-muted">{item.caption}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

function RelatedSection({ locale, cards }: { locale: AngelLocale; cards: readonly RelatedCard[] }) {
  const id = useId()
  return (
    <section
      data-link-zone="related"
      data-table-section
      aria-labelledby={id}
      className="flex flex-col gap-3"
    >
      <h2 id={id} className="m-0 font-heading text-ink text-subtitle">
        {ANGEL_COPY[locale].relatedTitle}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.path} className="flex min-w-0">
            <LinkCard
              href={toolHref(card.path, locale)}
              title={card.title}
              description={card.description}
              className="w-full"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Faq({ page }: { page: AngelNumberPageData }) {
  return <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />
}

const numberHref = (locale: AngelLocale) => (number: string) =>
  toolHref(angelNumberPath(locale, number), locale)
const gridItems = (items: readonly AngelGridItem[]) =>
  items.map((item) => ({ key: item.number, label: item.number, caption: item.theme }))

// ---------------------------------------------------------------------------
// 枢纽
// ---------------------------------------------------------------------------

const GROUP_ORDER: readonly AngelGroup[] = ['triple', 'four', 'more']

export function HubPage({ page }: { page: AngelNumberPageData }) {
  const locale = page.locale
  const C = ANGEL_COPY[locale]
  const howId = useId()
  const rootId = useId()
  // en 按三位、四位、其他序列分组；es 数字较少，只有一组（设计稿 AngelHubEs，B9）
  const groups =
    locale === 'en'
      ? GROUP_ORDER.map((group) => ({
          group,
          items: page.numbers.filter((item) => angelGroup(item.number) === group),
        })).filter(({ items }) => items.length > 0)
      : [{ group: 'triple' as const, items: page.numbers }]
  const lifePath = locale === 'en' ? '/life-path-number' : '/numero-de-vida'
  return (
    <Shell tool="angel-numbers">
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={C.hubCrumb}
        heading={page.heading}
        lede={page.lede}
      />
      {groups.map(({ group, items }) => (
        <GroupSection key={group} title={C.groups[group]} note={C.hubNote}>
          <NumberGrid items={gridItems(items)} hrefOf={numberHref(locale)} />
        </GroupSection>
      ))}
      <section aria-labelledby={howId} className="flex max-w-190 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 id={howId} className={h2}>
            {C.howTitle}
          </h2>
          <p className={muted}>{C.howIntro}</p>
        </div>
        {C.howSteps.length > 0 && (
          <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-3">
            {C.howSteps.map(([title, text], index) => (
              <li key={title} className="flex flex-col gap-2 rounded-object bg-surface p-5">
                <span aria-hidden="true" className="font-bold font-heading text-mark text-title">
                  {index + 1}
                </span>
                <h3 className="m-0 font-heading text-ink text-subtitle">{title}</h3>
                <p className="m-0 text-body text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      {C.rootTitle && (
        <section
          data-table-section
          data-link-zone="related"
          aria-labelledby={rootId}
          className="flex flex-col gap-4"
        >
          <h2 id={rootId} className={h2}>
            {C.rootTitle}
          </h2>
          <p className={muted}>{C.rootIntro}</p>
          <NumberGrid
            columns="nine"
            items={[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
              key: String(n),
              label: String(n),
            }))}
            hrefOf={(key) => toolHref(`${lifePath}/${key}`, locale)}
            label={C.rootTitle}
          />
        </section>
      )}
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Faq page={page} />
      <RelatedSection locale={locale} cards={hubRelated(locale)} />
      <Disclaimer />
    </Shell>
  )
}

function GroupSection({
  title,
  note,
  children,
}: {
  title: string
  note?: string | undefined
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      data-table-section
      data-link-zone="related"
      aria-labelledby={id}
      className="flex flex-col gap-4"
    >
      <h2 id={id} className={h2}>
        {title}
      </h2>
      {children}
      {note && <p className={muted}>{note}</p>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 数字页
// ---------------------------------------------------------------------------

export function NumberPage({ page }: { page: AngelNumberPageData }) {
  const locale = page.locale
  const C = ANGEL_COPY[locale]
  const f = angelFacts(page.key)
  const breakdownId = useId()
  const questionId = useId()
  const nearbyId = useId()
  const digitThemes = f.distinct.map((d) =>
    f.distinct.length === 1 ? digitTheme(locale, d).long : `${d}: ${digitTheme(locale, d).short}`,
  )
  const rootLabel = f.master ? C.master(f.root) : String(f.root)
  return (
    <Shell tool="angel-numbers">
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={page.key}
        heading={page.heading}
        lede={page.lede}
      />
      <section
        data-table-section
        aria-labelledby={breakdownId}
        className="flex max-w-190 flex-col gap-6"
      >
        <section
          aria-label={C.quickLabel}
          data-locale-fixed
          className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8"
        >
          <p className="m-0 font-bold font-heading text-display text-mark">{page.key}</p>
          <dl className="m-0 grid w-full min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4">
            {(
              [
                [C.digits, digitsSummary(locale, f)],
                [C.root, rootLabel],
                [C.digitTheme(f.distinct.length), digitThemes.join(', ')],
                [C.rootTheme, digitTheme(locale, f.root).long],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-caption text-ink-subtle">{label}</dt>
                <dd className="m-0 font-heading text-ink text-subtitle">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <h2 id={breakdownId} className="m-0 font-heading text-ink text-subtitle">
          {C.breakdownTitle}
        </h2>
        <ol data-locale-fixed className="m-0 flex list-none flex-col p-0">
          {(
            [
              [C.stepDigits, f.digits.join(' · ')],
              [C.stepPattern, patternText(locale, f)],
              [C.stepSum, sumText(f)],
              [C.stepRoot, f.master ? C.rootKept(f.root) : String(f.root)],
            ] as const
          ).map(([label, value]) => (
            <li
              key={label}
              className="grid grid-cols-3 gap-3 border-line border-b py-2.5 text-body last:border-b-0 sm:grid-cols-5"
            >
              <span className="text-ink-subtle">{label}</span>
              <span className="col-span-2 text-ink sm:col-span-4">{value}</span>
            </li>
          ))}
        </ol>
      </section>
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <section aria-labelledby={questionId} className="flex max-w-180 flex-col gap-5">
        <h2 id={questionId} className={h2}>
          {C.questionTitle}
        </h2>
        <p className="m-0 rounded-object bg-surface px-6 py-5 text-body text-ink-muted">
          {page.question}
        </p>
      </section>
      {page.numbers.length > 1 && (
        <nav
          data-link-zone="siblings"
          data-table-section
          aria-labelledby={nearbyId}
          className="flex flex-col gap-4"
        >
          <h2 id={nearbyId} className={h2}>
            {C.nearbyTitle}
          </h2>
          <NumberGrid
            items={gridItems(page.numbers)}
            hrefOf={numberHref(locale)}
            current={page.key}
          />
          <p className="m-0">
            <a href={toolHref(ANGEL_HUB_PATHS[locale], locale)} className={inlineLink}>
              {C.allNumbers}
            </a>
          </p>
        </nav>
      )}
      <Faq page={page} />
      <RelatedSection locale={locale} cards={numberRelated(locale, f, page.key)} />
      <Disclaimer />
    </Shell>
  )
}
