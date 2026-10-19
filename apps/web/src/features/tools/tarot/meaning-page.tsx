import {
  CARD_MEANINGS,
  CARDS,
  type DrawnCard,
  drawCards,
  shuffleDeck,
  spreadPositions,
} from '@xuanxue/tarot'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import { ToolContext, useTool } from '../context.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolLinks } from '../tool-links.tsx'
import { useToolEvents } from '../use-tool-events.ts'
import { CardFace, prefetchCards } from './card.tsx'
import { orientationLabel } from './copy.ts'
import type { TarotMeaningPage } from './meaning.functions.ts'
import { relatedCards, tarotMeaningPath } from './meaning-routes.ts'
import type { TarotLocale } from './routes.ts'
import { SpreadTable } from './table.tsx'

/** 复用牌阵的加密抽牌、预取、键盘翻牌与 reduced-motion 展示。 */
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
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <h2 id="tarot-try-title" className="m-0 font-heading text-2xl">
        {m.tarot_meaning_try()}
      </h2>
      <p className="m-0 text-ink-muted">{m.tarot_meaning_try_intro()}</p>
      <button
        type="button"
        disabled={!hydrated}
        onClick={draw}
        className="min-h-11 self-start rounded-lg bg-brand px-5 font-semibold text-on-brand focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {m.tarot_meaning_draw()}
      </button>
      <div ref={table} data-testid="tarot-meaning-draw" data-hydrated={hydrated}>
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
      <div aria-live="polite">
        {revealed && card && meaning && data && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-heading text-xl">
              {meaning.name} · {orientationLabel(card.reversed)}
            </h3>
            <p className="m-0 text-ink-muted">
              {card.reversed ? meaning.reversed : meaning.upright}
            </p>
            <a
              href={toolHref(tarotMeaningPath(data.slug, locale), locale)}
              className="flex min-h-11 items-center text-brand-ink underline underline-offset-4"
            >
              {m.tarot_meaning_read()}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

export function TarotMeaningArticle({ content }: { content: TarotMeaningPage }) {
  const { locale } = content
  const card = CARDS.find((entry) => entry.id === content.cardId)
  const tool = `tarot-card-${content.cardId}`
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  if (!card) return null
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
          <header className="flex max-w-[820px] flex-col gap-3">
            <h1
              className={`m-0 font-heading font-semibold text-[32px] text-ink leading-tight sm:text-[44px]${locale === 'ko' ? ' break-keep' : ''}`}
            >
              {content.title}
            </h1>
            <p className="m-0 text-[17px] text-ink-muted leading-relaxed">{content.description}</p>
          </header>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,720px)_280px]">
            <article className="min-w-0">
              <section aria-label={m.tarot_meaning_gallery()} className="flex gap-5">
                {[false, true].map((reversed) => (
                  <figure key={String(reversed)} className="m-0 flex w-[140px] flex-col gap-2">
                    <CardFace
                      card={{ cardId: card.id, reversed }}
                      locale={locale}
                      loading="lazy"
                      sizes="140px"
                      className="h-auto w-full"
                    />
                    <figcaption className="text-center text-ink-muted text-sm">
                      {orientationLabel(reversed)}
                    </figcaption>
                  </figure>
                ))}
              </section>
              <RichContent
                html={content.html}
                className="text-ink-muted [&_h2]:font-heading [&_h2]:text-ink [&_h3]:text-ink [&_a]:text-brand-ink [&>p:last-child]:rounded-lg [&>p:last-child]:bg-surface-2 [&>p:last-child]:p-4 [&>p:last-child]:text-sm"
              />
            </article>
            <aside className="flex min-w-0 flex-col gap-8">
              <TryOneCard locale={locale} />
              <ToolLinks
                title={m.tarot_meaning_related()}
                links={relatedCards(card).map((other) => ({
                  href: toolHref(tarotMeaningPath(other.slug, locale), locale),
                  title: CARD_MEANINGS[locale][other.id]?.name ?? other.slug,
                  target: `tarot-card-${other.id}`,
                }))}
              />
            </aside>
          </div>
        </div>
      </ToolContext>
    </MarketingShell>
  )
}
