import { LinkCard } from '@xuanxue/ui'
import { useId } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import { GunghapPage } from '../../tools/bazi/gunghap-page.tsx'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import type { CompatPageData } from './page.functions.ts'

/** 长文排版同概念页：小节标题用 heading 角色，正文为弱化文字色 */
const prose =
  'max-w-180 [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-title [&_h3]:font-bold [&_h3]:font-heading [&_h3]:text-ink [&_h3]:text-subtitle [&_strong]:text-ink'

/**
 * 场景卡片（同组区块，data-link-zone="siblings"）：工具页列出全部 5 个场景，场景页列出其他 4 个。
 * 是导航不是正文，不计入正文内链数（docs/seo-internal-linking.md §3）。
 */
function ScenarioCards({
  locale,
  title,
  cards,
}: {
  locale: string
  title: string
  cards: CompatPageData['scenarios']
}) {
  const headingId = useId()
  if (cards.length === 0) return null
  return (
    <nav data-link-zone="siblings" aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="m-0 font-heading text-ink text-subtitle">
        {title}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.key} className="flex min-w-0">
            <LinkCard
              href={toolHref(card.path, locale)}
              title={card.title}
              description={card.note}
              className="w-full"
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

const faqItems = (faq: CompatPageData['faq']) => faq.map(({ q, a }) => ({ question: q, answer: a }))

/**
 * 合盘工具页与场景页（content-growth-v2-tools 第 13 组）：同一个合盘组件，场景页预选关系类型、
 * 换上本场景的 H1、导语、逐项解释、长文与 FAQ；工具页保留原 H1、简介与延伸阅读，补上长文与场景卡片。
 */
export function CompatPage({ page }: { page: CompatPageData }) {
  const { locale } = page
  const article = <RichContent html={page.html} className={prose} />
  if (page.kind === 'tool') {
    return (
      <MarketingShell>
        <GunghapPage
          locale={locale}
          items={page.items}
          itemsInBody
          article={article}
          faq={[
            { question: m.compat_faq_q1(), answer: m.compat_faq_a1() },
            { question: m.compat_faq_q2(), answer: m.compat_faq_a2() },
            ...faqItems(page.faq),
          ]}
          nav={
            <ScenarioCards
              locale={locale}
              title={m.compat_scenarios_title()}
              cards={page.scenarios}
            />
          }
        />
      </MarketingShell>
    )
  }
  return (
    <MarketingShell>
      <GunghapPage
        locale={locale}
        scenario={page.scenario}
        title={page.heading}
        intro={<p className="m-0">{page.lede}</p>}
        breadcrumb={
          <Breadcrumb
            items={page.crumbs.map((crumb, index) =>
              index === page.crumbs.length - 1
                ? { name: crumb.name }
                : { name: crumb.name, href: toolHref(crumb.path, locale) },
            )}
          />
        }
        items={page.items}
        article={article}
        faq={faqItems(page.faq)}
        links={page.links.map((link) => ({
          href: toolHref(link.path, locale),
          title: link.title,
          target: link.target,
        }))}
        nav={
          <ScenarioCards
            locale={locale}
            title={m.compat_scenarios_other()}
            cards={page.scenarios}
          />
        }
      />
    </MarketingShell>
  )
}
