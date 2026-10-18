import { CARD_MEANINGS, CARDS, type DrawnCard } from '@xuanxue/tarot'
import { cn } from '@xuanxue/ui'
import type { ComponentProps } from 'react'
import { m } from '../../../paraglide/messages.js'
import { orientationLabel } from './copy.ts'
import type { TarotLocale } from './routes.ts'

const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]))

/** 牌位与结果缩略图的 sizes：手机三列约 30vw，桌面最大约 160px */
export const CARD_SIZES = '(min-width: 640px) 160px, 30vw'

export function cardImage(cardId: string) {
  const card = CARD_BY_ID.get(cardId)
  if (!card) return null
  return { src: card.image.small, srcSet: `${card.image.small} 240w, ${card.image.large} 480w` }
}

/** 本语言 alt：牌名 + 正/逆位（specs/tarot-pages「动效与可访问性」） */
export function cardAlt(card: DrawnCard, locale: TarotLocale): string {
  const name = CARD_MEANINGS[locale][card.cardId]?.name ?? card.cardId
  return m.tarot_card_alt({ name, orientation: orientationLabel(card.reversed) })
}

/** 翻牌前预取牌面，翻开时直接命中缓存；sizes 与 <img> 一致，浏览器选中同一候选 */
export function prefetchCards(cards: readonly DrawnCard[]) {
  for (const card of cards) {
    const image = cardImage(card.cardId)
    if (!image) continue
    const preload = new Image()
    preload.sizes = CARD_SIZES
    preload.srcset = image.srcSet
    preload.src = image.src
  }
}

/** 内联牌背：首屏不请求任何图片；颜色取站点 token（西方夜蓝 + 星金，东方纸色 + 朱砂） */
export function CardBack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-full items-center justify-center rounded-[10px] border border-brand bg-surface-2 text-brand',
        className,
      )}
    >
      <svg viewBox="0 0 44 44" className="w-1/2 max-w-11" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="19" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M22 6l3.5 12.5L38 22l-12.5 3.5L22 38l-3.5-12.5L6 22l12.5-3.5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** 牌面图：逆位旋转 180°；只在翻开后渲染，首屏不加载 */
export function CardFace({
  card,
  locale,
  className,
  ...props
}: { card: DrawnCard; locale: TarotLocale } & Omit<ComponentProps<'img'>, 'src' | 'alt'>) {
  const image = cardImage(card.cardId)
  if (!image) return null
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={CARD_SIZES}
      alt={cardAlt(card, locale)}
      width={240}
      height={416}
      decoding="async"
      className={cn(
        'size-full rounded-[10px] border border-line-strong bg-[#ECE7DA] object-cover',
        card.reversed && 'rotate-180',
        className,
      )}
      {...props}
    />
  )
}
