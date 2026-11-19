// 只引用牌名：索引页不加载牌面图，也不引用抽牌逻辑
import { CARD_MEANINGS } from '@xuanxue/tarot'
import { PageWidth } from '@xuanxue/ui/project'
import { useMemo } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { Breadcrumb } from '../breadcrumb.tsx'
import { ToolContext } from '../context.tsx'
import { Disclaimer } from '../disclaimer.tsx'
import { InlineLinks, inlineLinkClass } from '../inline-links.tsx'
import { toolHref } from '../tool-href.ts'
import { useToolEvents } from '../use-tool-events.ts'
import { GROUP_NAME, GROUP_NOTE } from './copy.ts'
import { tarotMeaningPath } from './meaning-routes.ts'
import { CARD_GROUPS, majorNumeral } from './pairings.ts'
import { type TarotLocale, tarotPath } from './routes.ts'

/**
 * 牌义索引页（新页；设计稿 warm-refresh/TarotIndex.dc.html、TarotIndexEast.dc.html，使用者 2026-11-19 确认）：
 * 78 张牌按大阿尔卡那与四个花色分组，每张牌是服务端输出的真实 <a>，锚文本为「<牌名> Tarot」
 * （东方站「<牌名>塔罗牌」，见 tarot_index_link）；大牌的罗马数字在链接之外。
 * 桌面 4 列、手机 2 列，不加载任何牌图。导语链接三张牌与每日一张两个牌阵。
 */
export function TarotIndexPage({ locale }: { locale: TarotLocale }) {
  return (
    <MarketingShell>
      <TarotIndexContent locale={locale} />
    </MarketingShell>
  )
}

/** 索引页正文（不含页头页脚），组件测试直接渲染它 */
export function TarotIndexContent({ locale }: { locale: TarotLocale }) {
  const tool = 'tarot-card-index'
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [track])
  const heading = (suit: (typeof CARD_GROUPS)[number]['suit']) =>
    suit === 'major' ? GROUP_NAME.major() : m.tarot_group_suit({ suit: GROUP_NAME[suit]() })
  return (
    <ToolContext value={context}>
      <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
        <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
          <Breadcrumb
            items={[
              { name: m.marketing_nav_home(), href: toolHref('/', locale) },
              { name: m.tarot_index_crumb() },
            ]}
          />
          <h1
            className={`m-0 text-balance font-heading text-ink text-title${locale === 'ko' ? ' break-keep' : ''}`}
          >
            {m.tarot_index_title()}
          </h1>
          <p className="m-0 text-body text-ink-muted">
            <InlineLinks
              text={m.tarot_index_intro()}
              links={[
                {
                  href: toolHref(tarotPath('three-card', locale), locale),
                  target: 'tarot-three-card',
                },
                { href: toolHref(tarotPath('daily', locale), locale), target: 'tarot-daily' },
              ]}
            />
          </p>
        </header>
        {/* 页内目录：指向本页各分组的锚点，不是站内链接 */}
        <nav aria-label={m.tarot_index_toc()} className="flex gap-2 overflow-x-auto pb-1">
          {CARD_GROUPS.map(({ suit }) => (
            <a
              key={suit}
              href={`#${suit}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-field bg-surface-2 px-3.5 text-caption text-ink-muted no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              {GROUP_NAME[suit]()}
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
                {heading(suit)}
              </h2>
              <span className="text-caption text-ink-subtle">{GROUP_NOTE[suit]()}</span>
            </div>
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
                    href={toolHref(tarotMeaningPath(card.slug, locale), locale)}
                    onClick={() => track('tool_link_click', { target: `tarot-card-${card.id}` })}
                    className={`text-body ${inlineLinkClass}`}
                  >
                    {m.tarot_index_link({
                      name: CARD_MEANINGS[locale][card.id]?.name ?? card.slug,
                    })}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Disclaimer />
      </PageWidth>
    </ToolContext>
  )
}
