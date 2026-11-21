import { CARD_MEANINGS, CARDS, type Card, type SpreadId } from '@xuanxue/tarot'
import { PageWidth } from '@xuanxue/ui/project'
import { useMemo } from 'react'
import { MarketingShell } from '../marketing/marketing-shell.tsx'
import { RichContent } from '../marketing/rich-content.tsx'
import { Breadcrumb } from '../tools/breadcrumb.tsx'
import { ToolContext, useTool } from '../tools/context.tsx'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { ToolFaq } from '../tools/faq.tsx'
import { inlineLinkClass, LinkBand } from '../tools/inline-links.tsx'
import { CardFace } from '../tools/tarot/card.tsx'
import { answerLabel, orientationLabel } from '../tools/tarot/copy.ts'
import { EAST_EN_FEELINGS_ROOT, tarotMeaningPath } from '../tools/tarot/meaning-routes.ts'
import {
  CARD_GROUPS,
  majorNumeral,
  type RelatedRole,
  relatedAnchorIsShort,
  relatedCards,
} from '../tools/tarot/pairings.ts'
import { tarotPath } from '../tools/tarot/routes.ts'
import { TarotSpreadPage } from '../tools/tarot/tarot-page.tsx'
import { toolHref } from '../tools/tool-href.ts'
import { useToolEvents } from '../tools/use-tool-events.ts'
import { eastEnFaq, HOME_CRUMB } from './article.tsx'
import { FEELINGS_CARD, FEELINGS_INDEX, SPREADS } from './copy/tarot.ts'
import type { TarotFeelingsPage } from './feelings.functions.ts'
import { EastEnText } from './links.tsx'
import type { EastEnTarotData } from './route-data.ts'

/**
 * 东方站根路径英文的塔罗页面（openspec add-locales-eu-ja 5b，关键词地图方案 A）：
 * 牌阵页复用抽牌组件，正文取东方站英文文案；78 张「as feelings」牌页与索引为本站独有的内容角度，
 * 链接只指向东方站英文页面。
 */
const href = (path: string) => toolHref(path, 'en')
const cardName = (id: string, fallback: string) => CARD_MEANINGS.en[id]?.name ?? fallback
const fill = (text: string, name: string) => text.replaceAll('{name}', name)

export function EastEnSpreadRoute({ spread }: { spread: SpreadId }) {
  const copy = SPREADS[spread]
  return (
    <MarketingShell>
      <TarotSpreadPage
        spread={spread}
        locale="en"
        eastEn={{
          copy,
          cardLink: FEELINGS_CARD.cardLink,
          text: (text) => <EastEnText text={text} />,
          faq: eastEnFaq(copy.faq),
        }}
      />
    </MarketingShell>
  )
}

/** as feelings 索引页：78 张牌按大阿尔卡那与四个花色分组，锚文本「<牌名> as feelings」 */
export function EastEnFeelingsIndex() {
  const tool = 'tarot-card-index'
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
          <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
            <Breadcrumb items={[HOME_CRUMB, { name: FEELINGS_INDEX.nav }]} />
            <h1 className="m-0 text-balance font-heading text-ink text-title">
              {FEELINGS_INDEX.h1}
            </h1>
            <p className="m-0 text-body text-ink-muted">
              <EastEnText text={FEELINGS_INDEX.intro} />
            </p>
          </header>
          <nav aria-label="On this page" className="flex gap-2 overflow-x-auto pb-1">
            {CARD_GROUPS.map(({ suit }) => (
              <a
                key={suit}
                href={`#${suit}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-field bg-surface-2 px-3.5 text-caption text-ink-muted no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                {FEELINGS_INDEX.groups[suit].title}
              </a>
            ))}
          </nav>
          {CARD_GROUPS.map(({ suit, cards }) => (
            <section
              key={suit}
              id={suit}
              aria-labelledby={`${suit}-title`}
              className="flex scroll-mt-6 flex-col gap-3"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id={`${suit}-title`} className="m-0 font-heading text-ink text-title">
                  {FEELINGS_INDEX.groups[suit].title}
                </h2>
                <span className="text-caption text-ink-subtle">
                  {FEELINGS_INDEX.groups[suit].note}
                </span>
              </div>
              <p className="m-0 max-w-180 text-body text-ink-muted">
                {FEELINGS_INDEX.groups[suit].about}
              </p>
              <ul className="m-0 grid list-none grid-cols-2 gap-x-4 p-0 sm:grid-cols-4 sm:gap-x-8">
                {cards.map((card) => (
                  <li key={card.id} className="flex min-h-11 items-baseline gap-2 py-2">
                    {suit === 'major' && (
                      <span
                        aria-hidden="true"
                        className="min-w-8 shrink-0 text-caption text-ink-subtle"
                      >
                        {majorNumeral(card.number)}
                      </span>
                    )}
                    <a
                      href={href(tarotMeaningPath(card.slug, 'en', 'east'))}
                      onClick={() => track('tool_link_click', { target: `tarot-card-${card.id}` })}
                      className={`text-body ${inlineLinkClass}`}
                    >
                      {fill(FEELINGS_CARD.cardLink, cardName(card.id, card.slug))}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Disclaimer />
        </PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

const RELATED_LABEL: Readonly<Record<RelatedRole, (major: boolean) => string>> = {
  before: () => FEELINGS_CARD.related.before,
  after: () => FEELINGS_CARD.related.after,
  'after-2': () => FEELINGS_CARD.related.after2,
  pair: (major) => (major ? FEELINGS_CARD.related.pairMajor : FEELINGS_CARD.related.pairMinor),
}

/**
 * 相关牌：与西方站牌义页同一组配对（前后两张与主题配对），锚文本按目标牌一半用短变体「<牌名>」。
 * 不列关键词：与西方站同类区块的数据相同（跨站相似度门槛）
 */
function RelatedFeelings({ card }: { card: Card }) {
  const { track } = useTool()
  const major = card.suit === 'major'
  const name = cardName(card.id, card.slug)
  return (
    <section aria-labelledby="feelings-related-title" className="flex max-w-180 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2
          id="feelings-related-title"
          className="m-0 text-balance font-heading text-ink text-title"
        >
          {FEELINGS_CARD.relatedTitle}
        </h2>
        <p className="m-0 text-body text-ink-muted">
          {fill(major ? FEELINGS_CARD.relatedIntroMajor : FEELINGS_CARD.relatedIntroMinor, name)}
        </p>
      </div>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
        {relatedCards(card).map(({ card: other, role }) => {
          const otherName = cardName(other.id, other.slug)
          return (
            <li key={other.id} className="flex flex-col gap-0.5">
              <span className="text-caption text-ink-subtle">
                {other.suit === 'major' && `${majorNumeral(other.number)} · `}
                {RELATED_LABEL[role](major)}
              </span>
              <a
                href={href(tarotMeaningPath(other.slug, 'en', 'east'))}
                onClick={() => track('tool_link_click', { target: `tarot-card-${other.id}` })}
                className={`self-start text-body ${inlineLinkClass}`}
              >
                {relatedAnchorIsShort(card, other)
                  ? otherName
                  : fill(FEELINGS_CARD.cardLink, otherName)}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const articleProse =
  '[&_h2:first-child]:mt-0 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-balance [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-title [&_h3]:font-heading [&_h3]:text-ink [&_h3]:text-subtitle [&_li]:text-body [&_p]:text-body'

/**
 * as feelings 牌页：面包屑、H1、导语 → 正逆位牌面与速览 → 正文 → 相关牌（4 条）→ FAQ → 转化条 → 声明。
 * 正文不含链接（content-collections 校验），站内链接由本模板给出。
 */
export function EastEnFeelingsCard({ content }: { content: TarotFeelingsPage }) {
  const card = CARDS.find((entry) => entry.id === content.cardId)
  const tool = `tarot-card-${content.cardId}`
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  if (!card) return null
  const name = cardName(card.id, card.slug)
  const meaning = CARD_MEANINGS.en[card.id]
  const group =
    card.suit === 'major'
      ? `${FEELINGS_INDEX.groups.major.title} · ${majorNumeral(card.number)}`
      : FEELINGS_INDEX.groups[card.suit].title
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
          <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
            <Breadcrumb
              items={[
                HOME_CRUMB,
                { name: FEELINGS_CARD.crumb, href: href(EAST_EN_FEELINGS_ROOT) },
                { name: fill(FEELINGS_CARD.cardLink, name) },
              ]}
            />
            <h1 className="m-0 text-balance font-heading text-ink text-title">{content.title}</h1>
            <p className="m-0 text-body text-ink-muted">{content.description}</p>
          </header>
          <section
            aria-label={fill(FEELINGS_CARD.cardLink, name)}
            className="flex max-w-180 flex-col gap-6 sm:flex-row sm:items-start sm:gap-10"
          >
            <div className="flex shrink-0 gap-4">
              {[false, true].map((reversed) => (
                <figure key={String(reversed)} className="m-0 flex w-33 flex-col gap-2">
                  <CardFace
                    card={{ cardId: card.id, reversed }}
                    locale="en"
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
                [FEELINGS_CARD.facts.group, group],
                [FEELINGS_CARD.facts.keywords, meaning?.keywords.join(' · ') ?? ''],
                [
                  FEELINGS_CARD.facts.yesNo,
                  [false, true]
                    .map(
                      (reversed) =>
                        `${orientationLabel(reversed)}: ${answerLabel(card.yesNo[reversed ? 'reversed' : 'upright'])}`,
                    )
                    .join(' · '),
                ],
              ].map(([term, value]) => (
                <div key={term} className="flex flex-col gap-0.5">
                  <dt className="text-caption text-ink-subtle">{term}</dt>
                  <dd className="m-0 text-body text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <article className="max-w-180 text-ink-muted">
            <RichContent html={content.html} className={articleProse} />
          </article>
          <RelatedFeelings card={card} />
          <ToolFaq
            title={FEELINGS_CARD.faqTitle}
            items={content.faq.map((item) => ({ question: item.q, answer: item.a }))}
          />
          <LinkBand
            link={{ href: href(tarotPath('three-card', 'en', 'east')), target: 'tarot-three-card' }}
            label={FEELINGS_CARD.bandLabel}
          >
            {fill(FEELINGS_CARD.band, name)}
          </LinkBand>
          <p role="note" className="m-0 max-w-180 text-caption text-ink-subtle">
            {FEELINGS_CARD.note}
          </p>
        </PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

/** 东方站根路径英文塔罗页面的路由组件：按 route-data 解析出的页面类型渲染 */
export function EastEnTarotPage({ data }: { data: EastEnTarotData }) {
  if (data.kind === 'spread') return <EastEnSpreadRoute spread={data.spread} />
  if (data.kind === 'index') return <EastEnFeelingsIndex />
  return <EastEnFeelingsCard content={data.content} />
}
