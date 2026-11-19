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
import { Fragment, useEffect, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { Breadcrumb } from '../breadcrumb.tsx'
import { CheckboxField, SubmitButton, TextField, ToolForm } from '../form.tsx'
import { InlineLinks } from '../inline-links.tsx'
import { ReadingGuide } from '../reading-guide.tsx'
import { ReadingSlots } from '../reading-slots.tsx'
import { ResultBlock } from '../result-block.tsx'
import { readShareFragment, shareUrl } from '../share.ts'
import { ShareLink } from '../share-link.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolPage } from '../tool-page.tsx'
import { prefetchCards } from './card.tsx'
import { answerLabel, orientationLabel, SPREAD_COPY } from './copy.ts'
import { tarotIndexPath, tarotMeaningPath } from './meaning-routes.ts'
import { TAROT_SPREADS, type TarotLocale, tarotPath, tarotTitle } from './routes.ts'
import { CutSpread, DeckStack, SpreadTable, type Stage, useShuffleFrames } from './table.tsx'

const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]))

/** 「其他塔罗牌阵」一段里指向各牌阵的句子：锚文本是目标牌阵的主关键词 */
const MORE_SPREADS: Readonly<Record<SpreadId, () => string>> = {
  'three-card': m.tarot_more_three_card,
  daily: m.tarot_more_daily,
  'yes-or-no': m.tarot_more_yes_or_no,
  'celtic-cross': m.tarot_more_celtic_cross,
}

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
 * 塔罗牌阵页（openspec add-tarot-reading specs/tarot-pages；设计稿 warm-refresh/TarotDraw.dc.html）：
 * 面包屑、H1 与导语（链接牌义索引）→ 表单面板（问题框、收起的问句模板、逆位开关与唯一的主按钮）→
 * 牌桌（洗牌 → 铺牌切牌 → 翻牌）→ 结果与分享 → 牌位说明、不能问的问题、其他牌阵（一段话 3 条链接）→ FAQ。
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
    // 重新洗牌后去掉旧结果的片段，避免之后返回时恢复上一组牌
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    )
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

  // 结果写入 `#r=` 片段（与分享链接同格式）：阅读牌义后用浏览器后退返回，页面会恢复同一组牌，
  // 可以继续翻看其它牌的牌义，而不必重新洗牌抽牌
  useEffect(() => {
    if (!complete || !reading) return
    window.history.replaceState(
      window.history.state,
      '',
      shareUrl(window.location.href, { reading: encodeReading(reading) }),
    )
  }, [complete, reading])

  const others = TAROT_SPREADS.filter((item) => item !== spread)

  return (
    <ToolPage
      tool={`tarot-${spread}`}
      breadcrumb={
        <Breadcrumb
          items={[
            { name: m.marketing_nav_home(), href: toolHref('/', locale) },
            { name: tarotTitle(spread, locale) },
          ]}
        />
      }
      title={copy.h1()}
      intro={
        <p className="m-0">
          {copy.intro()}{' '}
          <InlineLinks
            text={m.tarot_meanings_note()}
            links={[{ href: toolHref(tarotIndexPath(locale), locale), target: 'tarot-card-index' }]}
          />
        </p>
      }
      form={
        <>
          <ToolForm label={m.tarot_form_label()} onSubmit={shuffle} className="sm:grid-cols-1">
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
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <CheckboxField
                label={m.tarot_reversals_label()}
                checked={reversals}
                onChange={(event) => setReversals(event.currentTarget.checked)}
              />
              <SubmitButton>
                {stage === 'shuffling'
                  ? m.tarot_shuffling()
                  : stage === 'ready'
                    ? m.tarot_shuffle()
                    : m.tarot_again()}
              </SubmitButton>
            </div>
          </ToolForm>
          {shared === 'invalid' && (
            <div
              role="alert"
              className="flex max-w-190 items-start gap-2.5 rounded-field bg-surface-2 px-4 py-3 text-body text-ink"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-danger"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 6v5M10 13.8v.2" />
              </svg>
              <p className="m-0">{m.tarot_shared_invalid()}</p>
            </div>
          )}
          <section
            ref={table}
            aria-label={m.tarot_spread_label()}
            data-stage={stage}
            data-hydrated={hydrated}
            data-testid="tarot-table"
            className="flex max-w-190 flex-col gap-5 rounded-object bg-surface p-6 sm:p-8"
          >
            <Steps stage={stage} />
            {shared === 'ok' && (
              <p className="m-0 text-center text-caption text-ink-subtle">
                {m.tarot_shared_note()}
              </p>
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
              <div className="flex flex-col items-center gap-1">
                <p className="m-0 text-center text-caption text-ink-subtle">
                  {m.tarot_flip_prompt()}
                </p>
                {/* 次要操作用文字按钮：页面上只有「洗牌」一个主按钮 */}
                <button
                  type="button"
                  onClick={() => setRevealed(reading.cards.map(() => true))}
                  className="inline-flex min-h-11 items-center rounded-field text-body text-brand-ink underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                >
                  {m.tarot_reveal_all()}
                </button>
              </div>
            )}
          </section>
        </>
      }
      result={
        complete && reading ? (
          <TarotResult reading={reading} locale={locale} question={question} />
        ) : null
      }
      article={
        <article className="flex max-w-180 flex-col gap-5 text-body text-ink-muted">
          <h2 id="tarot-positions" className={articleHeading}>
            {m.tarot_positions_title()}
          </h2>
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-6">
            {positions.map((position) => (
              <li key={position.name}>
                <strong className="font-medium text-ink">{position.name}</strong> —{' '}
                {position.meaning}
              </li>
            ))}
          </ol>
          <h2 id="tarot-not-ask" className={articleHeading}>
            {m.tarot_not_ask_title()}
          </h2>
          <p className="m-0">{m.tarot_not_ask_intro()}</p>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-6">
            <li>{m.tarot_not_ask_1()}</li>
            <li>{m.tarot_not_ask_2()}</li>
            <li>{m.tarot_not_ask_3()}</li>
          </ul>
          {/* 牌阵互导：一段话里的 3 条链接，取代页尾的链接矩阵（Proposals79 C 表） */}
          <h2 id="tarot-more" className={articleHeading}>
            {m.tarot_matrix_title()}
          </h2>
          <p className="m-0">
            {others.map((item, index) => (
              <Fragment key={item}>
                {index > 0 && ' '}
                <InlineLinks
                  text={MORE_SPREADS[item]()}
                  links={[
                    { href: toolHref(tarotPath(item, locale), locale), target: `tarot-${item}` },
                  ]}
                />
              </Fragment>
            ))}
          </p>
        </article>
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
        {(spread === 'daily' || spread === 'yes-or-no') && complete && reading && (
          <ReadingGuide
            kind="tarot-spread"
            body={m.funnel_guide_tarot()}
            to={{
              href: toolHref(tarotPath('three-card', locale), locale),
              label: m.funnel_guide_tarot_cta(),
              target: 'tarot-three-card',
            }}
          />
        )}
      </ReadingSlots>
    </ToolPage>
  )
}

/** 结果之后的说明长文小标题：title 角色；与上一段的间距由 article 的 gap 加上边距给出 */
const articleHeading = 'm-0 mt-5 text-balance font-heading text-ink text-title first:mt-0'

/**
 * 问句模板：默认收起（设计稿：首屏类按钮元素只剩一个主按钮），展开后点击填入问题框，可直接洗牌。
 * 原生 details，无需脚本即可展开。
 */
function QuestionTemplates({
  templates,
  onPick,
}: {
  templates: readonly string[]
  onPick: (question: string) => void
}) {
  return (
    <details className="group min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-brand-ink text-caption underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        {m.tarot_templates_label()}
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
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
      <p className="sr-only">{m.tarot_templates_hint()}</p>
      {/* 手机端单行横向滑动；桌面换行 */}
      <div className="flex gap-2 overflow-x-auto pt-2 pb-1 sm:flex-wrap sm:overflow-visible">
        {templates.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => onPick(template)}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-field bg-surface-2 px-3 text-caption text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            {template}
          </button>
        ))}
      </div>
    </details>
  )
}

/** 步骤指示：三个步骤名与连接线，当前步骤用正文色（设计稿 `.tsteps`） */
function Steps({ stage }: { stage: Stage }) {
  const current = stage === 'reveal' ? 2 : stage === 'cut' ? 1 : 0
  const steps = [m.tarot_step_shuffle(), m.tarot_step_cut(), m.tarot_step_reveal()]
  return (
    <ol
      aria-label={m.tarot_steps_label()}
      className="m-0 flex list-none items-center justify-center gap-2.5 p-0 text-caption"
    >
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2.5',
            index === current ? 'font-medium text-ink' : 'text-ink-subtle',
          )}
        >
          {index > 0 && <span aria-hidden="true" className="h-px w-5 bg-line-strong" />}
          {step}
        </li>
      ))}
    </ol>
  )
}

/** 结果：是/否答案与判定依据（是/否牌阵），每张牌的牌位、正逆位、关键词、短义与牌义链接，分享链接 */
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
        <p className="m-0 text-body text-ink-muted">
          {m.tarot_question_label()}: <q className="text-ink">{question.trim()}</q>
        </p>
      )}
      {answer && (
        <ResultBlock id="answer" title={m.tarot_answer_title()} description={m.tarot_basis()}>
          <p
            data-testid="tarot-answer"
            className="m-0 font-bold font-heading text-display text-ink"
          >
            {answerLabel(answer.answer)}
          </p>
          <h3 className="m-0 font-medium text-body text-ink">{m.tarot_basis_title()}</h3>
          <p data-testid="tarot-answer-reason" className="m-0 text-body text-ink-muted">
            {answer.reason}
          </p>
        </ResultBlock>
      )}
      <div
        className={cn(
          'grid max-w-180 gap-6',
          reading.cards.length > 1 && 'sm:max-w-none sm:grid-cols-3 sm:gap-8',
        )}
      >
        {reading.cards.map((card, index) => {
          const meaning = CARD_MEANINGS[locale][card.cardId]
          const position = positions[index]
          const cardData = CARD_BY_ID.get(card.cardId)
          if (!meaning || !position || !cardData) return null
          return (
            <div
              key={card.cardId}
              id={`card-${index + 1}`}
              className="flex scroll-mt-6 flex-col gap-1.5"
              data-testid="tarot-result-card"
              data-card={card.cardId}
            >
              <span className="text-caption text-ink-subtle">{position.name}</span>
              <h3 className="m-0 font-heading text-ink text-subtitle">
                {meaning.name} ·{' '}
                <span data-testid="tarot-orientation">{orientationLabel(card.reversed)}</span>
              </h3>
              <p className="m-0 text-caption text-ink-subtle">
                {m.tarot_keywords_label()}: {meaning.keywords.join(' · ')}
              </p>
              <p className="m-0 text-body text-ink-muted">
                {card.reversed ? meaning.reversed : meaning.upright}
              </p>
              <a
                href={toolHref(tarotMeaningPath(cardData.slug, locale), locale)}
                // 牌义在新标签页打开，抽牌页保留本次结果，切回即可继续翻看其它牌
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center self-start text-body text-brand-ink hover:decoration-2"
              >
                {m.tarot_meaning_link({ name: meaning.name })}
              </a>
            </div>
          )
        })}
      </div>
      <ShareLink input={{ reading: encodeReading(reading) }} />
    </>
  )
}
