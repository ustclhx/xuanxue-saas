import {
  CARD_MEANINGS,
  CARDS,
  type Card,
  type DrawnCard,
  drawCards,
  shuffleDeck,
  spreadPositions,
} from '@xuanxue/tarot'
import { PageWidth } from '@xuanxue/ui/project'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import { Breadcrumb } from '../breadcrumb.tsx'
import { ToolContext, useTool } from '../context.tsx'
import { ToolFaq } from '../faq.tsx'
import { inlineLinkClass, LinkBand } from '../inline-links.tsx'
import { faqItems } from '../numerology/seo.ts'
import { toolHref } from '../tool-href.ts'
import { useToolEvents } from '../use-tool-events.ts'
import { CardFace, prefetchCards } from './card.tsx'
import { answerLabel, GROUP_NAME, orientationLabel } from './copy.ts'
import type { TarotMeaningPage } from './meaning.functions.ts'
import { tarotIndexPath, tarotMeaningPath } from './meaning-routes.ts'
import { majorNumeral, type RelatedRole, relatedCards } from './pairings.ts'
import { type TarotLocale, tarotPath, tarotTitle } from './routes.ts'
import { SpreadTable } from './table.tsx'

/** 复用牌阵的加密抽牌、预取、键盘翻牌与 reduced-motion 展示；正文里的一个面板（设计稿 `.obj.try`）。 */
export function TryOneCard({ locale }: { locale: TarotLocale }) {
  const [card, setCard] = useState<DrawnCard | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const table = useRef<HTMLDivElement>(null)
  const { track } = useTool()
  useEffect(() => setHydrated(true), [])
  const meaning = card ? CARD_MEANINGS[locale][card.cardId] : undefined
  const data = card ? CARDS.find((entry) => entry.id === card.cardId) : undefined
  const draw = () => {
    const next = drawCards('daily', shuffleDeck(true)).cards[0]
    if (!next) return
    prefetchCards([next])
    setCard(next)
    setRevealed(false)
    track('tool_submit')
    requestAnimationFrame(() =>
      table.current?.querySelector<HTMLButtonElement>('[data-slot-index]')?.focus(),
    )
  }
  return (
    <section
      aria-labelledby="tarot-try-title"
      className="flex max-w-180 flex-col gap-4 rounded-object bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
        <div className="flex flex-col gap-2">
          <h2 id="tarot-try-title" className="m-0 font-heading text-ink text-subtitle">
            {m.tarot_meaning_try()}
          </h2>
          <p className="m-0 text-body text-ink-muted">{m.tarot_meaning_try_intro()}</p>
        </div>
        <button
          type="button"
          disabled={!hydrated}
          onClick={draw}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-primary px-7 font-medium text-body text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {m.tarot_meaning_draw()}
        </button>
      </div>
      <div
        ref={table}
        data-testid="tarot-meaning-draw"
        data-hydrated={hydrated}
        className="empty:hidden"
      >
        {card && (
          <SpreadTable
            spread="daily"
            cards={card ? [card] : []}
            positions={spreadPositions('daily', locale)}
            revealed={[revealed]}
            locale={locale}
            onReveal={() => {
              setRevealed(true)
              track('result_view')
            }}
          />
        )}
      </div>
      <div aria-live="polite" className="empty:hidden">
        {revealed && card && meaning && data && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-heading text-ink text-subtitle">
              {meaning.name} · {orientationLabel(card.reversed)}
            </h3>
            <p className="m-0 text-body text-ink-muted">
              {card.reversed ? meaning.reversed : meaning.upright}
            </p>
            <a
              href={toolHref(tarotMeaningPath(data.slug, locale), locale)}
              className="inline-flex min-h-11 items-center self-start text-body text-brand-ink hover:decoration-2"
            >
              {m.tarot_meaning_link({ name: meaning.name })}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * 正文拆成三段（设计稿 warm-refresh/TarotCard.dc.html 的顺序：长文 → 抽一张 → 延伸牌义 → FAQ → 转化条 → 声明）：
 * 正文最后一个 H2 是 FAQ，其后的最后一段是文末声明。FAQ 改由 ToolFaq 按 frontmatter 渲染（与 FAQPage 同源），
 * 声明以 caption 放在页尾。
 * 正文里指向牌阵的链接去掉 <a>、保留文字：牌义页的正文内链固定为 4 条延伸牌义加转化条 1 条（Proposals79 D 表），
 * 其余链接会超出每页 2–5 条的上限，也会给牌阵页带来第三种以上的锚文本。
 */
export function splitMeaningHtml(html: string): { body: string; note: string } {
  const cut = html.lastIndexOf('<h2')
  const body = (cut > 0 ? html.slice(0, cut) : html).replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1')
  const tail = cut > 0 ? html.slice(cut) : ''
  const last = tail.lastIndexOf('<p>')
  // 声明是一段纯文字：去掉标签并还原转义，页面用普通的 <p role="note"> 输出
  const note = (last >= 0 ? tail.slice(last) : '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, name: string) => ENTITIES[name] ?? '')
    .trim()
  return { body, note }
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#x27': "'",
  '#39': "'",
}

const RELATED_LABEL: Readonly<Record<RelatedRole, (major: boolean) => string>> = {
  before: () => m.tarot_related_before(),
  after: () => m.tarot_related_after(),
  'after-2': () => m.tarot_related_after_2(),
  pair: (major) => (major ? m.tarot_related_pair_major() : m.tarot_related_pair_minor()),
}

/** 牌所在的分组与序号：大牌「大阿尔卡那 · XIX」，小牌为花色名 */
function groupLabel(card: Card): string {
  return card.suit === 'major'
    ? `${GROUP_NAME.major()} · ${majorNumeral(card.number)}`
    : m.tarot_group_suit({ suit: GROUP_NAME[card.suit]() })
}

/**
 * 延伸牌义（设计稿 `.rel`；使用者 2026-11-19 确认）：正文里的一个 H2 区块，固定 4 条服务端输出的链接，
 * 每条为「小字说明 / 链接 / 一句描述」。锚文本为「<牌名> tarot card meaning」（各语言见 tarot_meaning_link）。
 */
function RelatedMeanings({ card, locale }: { card: Card; locale: TarotLocale }) {
  const { track } = useTool()
  const major = card.suit === 'major'
  const name = CARD_MEANINGS[locale][card.id]?.name ?? card.slug
  return (
    <section aria-labelledby="tarot-related-title" className="flex max-w-180 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="tarot-related-title" className="m-0 text-balance font-heading text-ink text-title">
          {m.tarot_meaning_related()}
        </h2>
        <p className="m-0 text-body text-ink-muted">
          {major ? m.tarot_related_intro_major({ name }) : m.tarot_related_intro_minor({ name })}
        </p>
      </div>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
        {relatedCards(card).map(({ card: other, role }) => {
          const meaning = CARD_MEANINGS[locale][other.id]
          return (
            <li key={other.id} className="flex flex-col gap-0.5">
              <span className="text-caption text-ink-subtle">
                {other.suit === 'major' && `${majorNumeral(other.number)} · `}
                {RELATED_LABEL[role](major)}
              </span>
              <a
                href={toolHref(tarotMeaningPath(other.slug, locale), locale)}
                onClick={() => track('tool_link_click', { target: `tarot-card-${other.id}` })}
                className={`self-start text-body ${inlineLinkClass}`}
              >
                {m.tarot_meaning_link({ name: meaning?.name ?? other.slug })}
              </a>
              <span className="text-body text-ink-muted">{meaning?.keywords.join(' · ')}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * 牌义页（设计稿 warm-refresh/TarotCard.dc.html）：单栏、没有侧栏。
 * 面包屑、H1、导语 → 正逆位牌面与速览 → 长文 → 抽一张面板 → 延伸牌义（4 条）→ FAQ → 一条转化条 → 声明。
 */
export function TarotMeaningArticle({ content }: { content: TarotMeaningPage }) {
  const { locale } = content
  const card = CARDS.find((entry) => entry.id === content.cardId)
  const tool = `tarot-card-${content.cardId}`
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  const { body, note } = useMemo(() => splitMeaningHtml(content.html), [content.html])
  if (!card) return null
  const meaning = CARD_MEANINGS[locale][card.id]
  const name = meaning?.name ?? card.slug
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
          <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
            <Breadcrumb
              items={[
                { name: m.marketing_nav_home(), href: toolHref('/', locale) },
                { name: m.tarot_index_crumb(), href: toolHref(tarotIndexPath(locale), locale) },
                { name },
              ]}
            />
            <h1
              className={`m-0 text-balance font-heading text-ink text-title${locale === 'ko' ? ' break-keep' : ''}`}
            >
              {content.title}
            </h1>
            <p className="m-0 text-body text-ink-muted">{content.description}</p>
          </header>
          <section
            aria-label={`${m.tarot_facts_label({ name })} · ${m.tarot_meaning_gallery()}`}
            className="flex max-w-180 flex-col gap-6 sm:flex-row sm:items-start sm:gap-10"
          >
            <div className="flex shrink-0 gap-4">
              {[false, true].map((reversed) => (
                <figure key={String(reversed)} className="m-0 flex w-33 flex-col gap-2">
                  {/* 首屏牌面：改版后正文段落变窄，132px 宽的牌面成为手机首屏最大元素（LCP）。
                      懒加载要等布局后才发请求，Lighthouse 模拟下 LCP 1.8–6.9 秒；正逆位同一张图，
                      直接加载并提高优先级，只多一次约 30KB 的请求（warm-lcp 修复） */}
                  <CardFace
                    card={{ cardId: card.id, reversed }}
                    locale={locale}
                    fetchPriority="high"
                    sizes="132px"
                    className="h-auto w-full"
                  />
                  <figcaption className="text-center text-caption text-ink-subtle">
                    {orientationLabel(reversed)}
                  </figcaption>
                </figure>
              ))}
            </div>
            <dl className="m-0 grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-1">
              {[
                [m.tarot_fact_group(), groupLabel(card)],
                [
                  m.tarot_fact_yes_no(),
                  [false, true]
                    .map((reversed) =>
                      m.tarot_fact_answer({
                        orientation: orientationLabel(reversed),
                        answer: answerLabel(card.yesNo[reversed ? 'reversed' : 'upright']),
                      }),
                    )
                    .join(' · '),
                ],
                [m.tarot_keywords_label(), meaning?.keywords.join(' · ') ?? ''],
              ].map(([term, value]) => (
                <div key={term} className="flex flex-col gap-0.5">
                  <dt className="text-caption text-ink-subtle">{term}</dt>
                  <dd className="m-0 text-body text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <article className="max-w-180 text-ink-muted">
            <RichContent html={body} className={articleProse} />
          </article>
          <TryOneCard locale={locale} />
          <RelatedMeanings card={card} locale={locale} />
          <ToolFaq items={faqItems(content.faq)} />
          <LinkBand
            link={{
              href: toolHref(tarotPath('three-card', locale), locale),
              target: 'tarot-three-card',
            }}
            label={tarotTitle('three-card', locale)}
          >
            {m.tarot_meaning_band({ name })}
          </LinkBand>
          {note && (
            <p role="note" className="m-0 max-w-180 text-caption text-ink-subtle">
              {note}
            </p>
          )}
        </PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

/** 牌义长文（构建期渲染的 HTML）：限宽 720px，小标题用 title、正文用 body（与数字命理长文同一套角色） */
const articleProse =
  '[&_h2:first-child]:mt-0 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-balance [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-title [&_h3]:font-heading [&_h3]:text-ink [&_h3]:text-subtitle [&_li]:text-body [&_p]:text-body'
