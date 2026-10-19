import {
  CARD_MEANINGS,
  CARDS,
  cutDeck,
  type DrawnCard,
  decodeReading,
  drawCards,
  encodeReading,
  type Reading,
  type SpreadId,
  shuffleDeck,
  spreadPositions,
  yesNoAnswer,
} from '@xuanxue/tarot'
import { cn } from '@xuanxue/ui'
import { useEffect, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { CheckboxField, SubmitButton, TextField, ToolForm } from '../form.tsx'
import { ReadingSlots } from '../reading-slots.tsx'
import { ResultBlock } from '../result-block.tsx'
import { readShareFragment } from '../share.ts'
import { ShareLink } from '../share-link.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolLinks } from '../tool-links.tsx'
import { ToolPage } from '../tool-page.tsx'
import { prefetchCards } from './card.tsx'
import { answerLabel, orientationLabel, SPREAD_COPY } from './copy.ts'
import { tarotMeaningPath } from './meaning-routes.ts'
import { TAROT_SPREADS, type TarotLocale, tarotPath } from './routes.ts'
import { CutSpread, DeckStack, SpreadTable, type Stage, useShuffleFrames } from './table.tsx'

const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]))

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** 分享片段中的抽牌结果；牌阵与当前页面不一致或内容非法时视为无效 */
export function sharedReading(hash: string, spread: SpreadId): Reading | 'invalid' | null {
  const shared = readShareFragment(hash)
  if (!shared) return hash.includes('r=') ? 'invalid' : null
  try {
    const reading = decodeReading(String(shared.reading ?? ''))
    return reading.spread === spread ? reading : 'invalid'
  } catch {
    return 'invalid'
  }
}

/**
 * 塔罗牌阵页（openspec add-tarot-reading specs/tarot-pages）：H1 与导语、问题框与问句模板、
 * 洗牌 → 铺牌切牌 → 翻牌、结果与分享、牌阵互导、不能问的问题、牌位说明与 FAQ。
 * 洗牌与抽牌只在浏览器中进行（加密随机数），分享链接 `#r=` 只含牌阵、牌与正逆位，不含问题。
 */
export function TarotSpreadPage({ spread, locale }: { spread: SpreadId; locale: TarotLocale }) {
  const copy = SPREAD_COPY[spread]
  const positions = spreadPositions(spread, locale)
  const [question, setQuestion] = useState('')
  const [reversals, setReversals] = useState(true)
  const [stage, setStage] = useState<Stage>('ready')
  const [deck, setDeck] = useState<DrawnCard[] | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [shared, setShared] = useState<'none' | 'ok' | 'invalid'>('none')
  const [hydrated, setHydrated] = useState(false)
  const table = useRef<HTMLElement>(null)
  const frame = useShuffleFrames(stage === 'shuffling', () => setStage('cut'))

  // 打开分享链接时直接显示同一组牌，不重新抽牌
  useEffect(() => {
    setHydrated(true)
    const result = sharedReading(window.location.hash, spread)
    if (result === 'invalid') setShared('invalid')
    else if (result) {
      setReading(result)
      setRevealed(result.cards.map(() => true))
      setStage('reveal')
      setShared('ok')
    }
  }, [spread])

  const shuffle = () => {
    setDeck(shuffleDeck(reversals))
    setReading(null)
    setRevealed([])
    setShared('none')
    // 减少动态效果时跳过洗牌动画，铺开的牌直接淡入
    setStage(prefersReducedMotion() ? 'cut' : 'shuffling')
  }

  const cut = (position: number) => {
    if (!deck) return
    const next = drawCards(spread, cutDeck(deck, position))
    prefetchCards(next.cards)
    setReading(next)
    setRevealed(next.cards.map(() => false))
    setStage('reveal')
    requestAnimationFrame(() =>
      table.current?.querySelector<HTMLButtonElement>('[data-slot-index]:not(:disabled)')?.focus(),
    )
  }

  const reveal = (index: number) => {
    const next = revealed.map((value, i) => value || i === index)
    setRevealed(next)
    // 翻开后焦点移到下一张未翻开的牌，键盘可连续翻牌
    const following = next.findIndex((value) => !value)
    if (following !== -1)
      requestAnimationFrame(() =>
        table.current
          ?.querySelector<HTMLButtonElement>(`[data-slot-index="${following}"]`)
          ?.focus(),
      )
  }

  const complete = reading !== null && revealed.length > 0 && revealed.every(Boolean)
  const links = TAROT_SPREADS.filter((item) => item !== spread).map((item) => ({
    href: toolHref(tarotPath(item, locale), locale),
    title: SPREAD_COPY[item].link(),
    target: `tarot-${item}`,
  }))

  return (
    <ToolPage
      tool={`tarot-${spread}`}
      title={copy.h1()}
      intro={<p className="m-0">{copy.intro()}</p>}
      form={
        <ToolForm
          label={m.tarot_form_label()}
          onSubmit={shuffle}
          className="flex flex-col gap-5 border-0 bg-transparent p-0 sm:p-0"
        >
          {/* 问题框与逆位开关不设 name：脚本加载前提交表单时，问题不会进入地址栏 */}
          <TextField
            label={m.tarot_question_label()}
            value={question}
            placeholder={m.tarot_question_placeholder()}
            autoComplete="off"
            maxLength={200}
            onChange={(event) => setQuestion(event.currentTarget.value)}
          />
          <QuestionTemplates templates={copy.templates.map((t) => t())} onPick={setQuestion} />
          <section
            ref={table}
            aria-label={m.tarot_spread_label()}
            data-stage={stage}
            data-hydrated={hydrated}
            data-testid="tarot-table"
            className="flex flex-col gap-4"
          >
            <Steps stage={stage} />
            {shared === 'ok' && (
              <p className="m-0 text-center text-ink-muted text-sm">{m.tarot_shared_note()}</p>
            )}
            {shared === 'invalid' && (
              <p className="m-0 text-center text-ink-muted text-sm">{m.tarot_shared_invalid()}</p>
            )}
            {stage === 'shuffling' && <DeckStack frame={frame} shuffling />}
            {stage === 'cut' && <CutSpread onCut={cut} />}
            {(stage === 'ready' || stage === 'reveal') && (
              <SpreadTable
                spread={spread}
                cards={reading?.cards ?? []}
                positions={positions}
                revealed={revealed}
                locale={locale}
                onReveal={reveal}
              />
            )}
            {stage === 'reveal' && reading && !complete && (
              <div className="flex flex-col items-center gap-2">
                <p className="m-0 text-center text-ink-muted text-sm">{m.tarot_flip_prompt()}</p>
                <button
                  type="button"
                  onClick={() => setRevealed(reading.cards.map(() => true))}
                  className="min-h-11 rounded-lg border border-line-strong px-5 text-base text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                >
                  {m.tarot_reveal_all()}
                </button>
              </div>
            )}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <CheckboxField
              label={m.tarot_reversals_label()}
              checked={reversals}
              onChange={(event) => setReversals(event.currentTarget.checked)}
            />
            <SubmitButton className="w-full self-auto sm:w-auto">
              {stage === 'shuffling'
                ? m.tarot_shuffling()
                : stage === 'ready'
                  ? m.tarot_shuffle()
                  : m.tarot_again()}
            </SubmitButton>
          </div>
        </ToolForm>
      }
      result={
        complete && reading ? (
          <TarotResult reading={reading} locale={locale} question={question} />
        ) : null
      }
      faq={copy.faq.map(([q, a]) => ({ question: q(), answer: a() }))}
    >
      <ReadingSlots
        tool={`tarot-${spread}`}
        optin={
          complete && reading
            ? {
                result: { kind: 'tarot', cards: [...reading.cards] },
                share: { reading: encodeReading(reading) },
              }
            : null
        }
      >
        {(spread === 'three-card' || spread === 'celtic-cross') && (
          <ReadingUnlock
            kind="tarot-spread"
            request={
              complete && reading
                ? {
                    input: {
                      reading: encodeReading(reading),
                      ...(question.trim() ? { question: question.trim() } : {}),
                    },
                    share: { reading: encodeReading(reading) },
                  }
                : null
            }
          />
        )}
      </ReadingSlots>
      <ToolLinks links={links} title={m.tarot_matrix_title()} />
      <NotToAsk />
      <section aria-labelledby="tarot-positions" className="flex max-w-[720px] flex-col gap-3">
        <h2 id="tarot-positions" className="m-0 font-heading text-ink text-xl">
          {m.tarot_positions_title()}
        </h2>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {positions.map((position, index) => (
            <li key={position.name} className="flex gap-3 text-[15px] leading-relaxed">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-subtle text-sm"
              >
                {index + 1}
              </span>
              <span>
                <strong className="font-semibold text-ink">{position.name}</strong>
                <span className="text-ink-muted"> — {position.meaning}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </ToolPage>
  )
}

/** 问句模板：点击后填入问题框，可直接洗牌 */
function QuestionTemplates({
  templates,
  onPick,
}: {
  templates: readonly string[]
  onPick: (question: string) => void
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-ink-muted text-sm">
        {m.tarot_templates_label()}
        <span className="sr-only"> · {m.tarot_templates_hint()}</span>
      </legend>
      {/* 手机端单行横向滑动，首屏留给牌桌；桌面换行 */}
      <div className="-my-1 flex gap-2 overflow-x-auto py-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        {templates.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => onPick(template)}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-line-strong px-3.5 text-ink-muted text-sm transition-colors hover:border-brand hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            {template}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Steps({ stage }: { stage: Stage }) {
  const current = stage === 'reveal' ? 2 : stage === 'cut' ? 1 : 0
  const steps = [m.tarot_step_shuffle(), m.tarot_step_cut(), m.tarot_step_reveal()]
  return (
    <ol
      aria-label={m.tarot_steps_label()}
      className="m-0 flex list-none items-center justify-center gap-2 p-0 text-sm"
    >
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2',
            index === current ? 'text-ink' : 'text-ink-subtle',
          )}
        >
          {index > 0 && <span aria-hidden="true" className="h-px w-5 bg-line-strong" />}
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-full border text-xs',
              index === current ? 'border-brand text-brand-ink' : 'border-line-strong',
            )}
          >
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  )
}

function NotToAsk() {
  return (
    <section
      aria-labelledby="tarot-not-ask"
      className="flex max-w-[720px] flex-col gap-2 border-line border-t pt-5"
    >
      <h2 id="tarot-not-ask" className="m-0 font-heading text-ink text-xl">
        {m.tarot_not_ask_title()}
      </h2>
      <p className="m-0 text-[15px] text-ink-muted">{m.tarot_not_ask_intro()}</p>
      <ul className="m-0 pl-5 text-[15px] text-ink-muted leading-relaxed">
        <li>{m.tarot_not_ask_1()}</li>
        <li>{m.tarot_not_ask_2()}</li>
        <li>{m.tarot_not_ask_3()}</li>
      </ul>
    </section>
  )
}

/** 结果：是/否答案与判定依据（是/否牌阵），每张牌的牌位、正逆位、关键词与短义，分享链接 */
function TarotResult({
  reading,
  locale,
  question,
}: {
  reading: Reading
  locale: TarotLocale
  question: string
}) {
  const positions = spreadPositions(reading.spread, locale)
  const first = reading.cards[0]
  const answer = reading.spread === 'yes-or-no' && first ? yesNoAnswer(first, locale) : null
  return (
    <>
      {question.trim() && (
        <p className="m-0 text-ink-muted">
          {m.tarot_question_label()}: <q className="text-ink">{question.trim()}</q>
        </p>
      )}
      {answer && (
        <ResultBlock id="answer" title={m.tarot_answer_title()} description={m.tarot_basis()}>
          <p
            data-testid="tarot-answer"
            className="m-0 font-heading font-semibold text-5xl text-brand-ink"
          >
            {answerLabel(answer.answer)}
          </p>
          <h3 className="m-0 font-semibold text-base text-ink">{m.tarot_basis_title()}</h3>
          <p data-testid="tarot-answer-reason" className="m-0 text-ink-muted leading-relaxed">
            {answer.reason}
          </p>
        </ResultBlock>
      )}
      {reading.cards.map((card, index) => {
        const meaning = CARD_MEANINGS[locale][card.cardId]
        const position = positions[index]
        const cardData = CARD_BY_ID.get(card.cardId)
        if (!meaning || !position || !cardData) return null
        return (
          <ResultBlock
            key={card.cardId}
            id={`card-${index + 1}`}
            title={`${position.name} · ${meaning.name}`}
            aside={<span data-testid="tarot-orientation">{orientationLabel(card.reversed)}</span>}
            description={position.meaning}
          >
            <div
              className="flex flex-col gap-2"
              data-testid="tarot-result-card"
              data-card={card.cardId}
            >
              <p className="m-0 text-ink-subtle text-sm">
                {m.tarot_keywords_label()}: {meaning.keywords.join(' · ')}
              </p>
              <p className="m-0 text-ink leading-relaxed">
                {card.reversed ? meaning.reversed : meaning.upright}
              </p>
              <a
                href={toolHref(tarotMeaningPath(cardData.slug, locale), locale)}
                className="flex min-h-11 items-center text-brand-ink underline underline-offset-4"
              >
                {m.tarot_meaning_read()}
              </a>
            </div>
          </ResultBlock>
        )
      })}
      <ShareLink input={{ reading: encodeReading(reading) }} />
    </>
  )
}
