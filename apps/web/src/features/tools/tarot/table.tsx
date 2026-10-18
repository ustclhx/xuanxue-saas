import type { DrawnCard, Position, SpreadId } from '@xuanxue/tarot'
import { cn } from '@xuanxue/ui'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { CardBack, CardFace } from './card.tsx'
import type { TarotLocale } from './routes.ts'

export type Stage = 'ready' | 'shuffling' | 'cut' | 'reveal'

/** 洗牌动画：牌堆中的几层牌背左右交错，按 requestAnimationFrame 推进；只改 transform */
export const SHUFFLE_FRAMES = 7
const FRAME_MS = 140
const STACK_LAYERS = 5

export function useShuffleFrames(active: boolean, onDone: () => void) {
  const [frame, setFrame] = useState(0)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!active) return
    let handle = 0
    const start = performance.now()
    const step = (now: number) => {
      const next = Math.floor((now - start) / FRAME_MS)
      if (next >= SHUFFLE_FRAMES) {
        setFrame(0)
        done.current()
        return
      }
      setFrame(next)
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [active])
  return frame
}

/** 进入时从下方淡入：先渲染初始态，下一帧再切到终态，过渡才会生效 */
function useEntered(): boolean {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const handle = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(handle)
  }, [])
  return entered
}

const enter = 'transition-[opacity,transform] duration-500 ease-out motion-reduce:translate-y-0'

/** 洗牌前后的牌堆 */
export function DeckStack({ frame, shuffling }: { frame: number; shuffling: boolean }) {
  return (
    <div
      role="img"
      aria-label={m.tarot_deck_label()}
      className="relative mx-auto aspect-[0.58] w-28 sm:w-32"
    >
      {Array.from({ length: STACK_LAYERS }, (_, layer) => {
        const offset = shuffling && frame % 2 === 1 ? (layer % 2 === 0 ? -1 : 1) : 0
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 固定层数的装饰牌背
            key={layer}
            className="absolute inset-0 transition-transform duration-150 ease-out motion-reduce:transition-none"
            style={{
              transform: `translate(${offset * (28 + layer * 4)}px, ${-layer * 2}px) rotate(${offset * (4 + layer)}deg)`,
            }}
          >
            <CardBack />
          </span>
        )
      })}
    </div>
  )
}

/**
 * 铺牌并切牌：78 张牌背纵向叠放成网格，每张露出 ≥44px 的点击区域。
 * 网格只有一个 Tab 停靠点（roving tabindex），方向键移动、Enter / 空格切牌。
 */
export function CutSpread({ onCut }: { onCut: (position: number) => void }) {
  const entered = useEntered()
  const [focus, setFocus] = useState(0)
  const grid = useRef<HTMLDivElement>(null)
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const columns =
      getComputedStyle(grid.current as HTMLElement).gridTemplateColumns.split(' ').length || 1
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    }
    let next = index + (delta[event.key] ?? 0)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = 77
    if (next === index || next < 0 || next > 77) return
    event.preventDefault()
    setFocus(next)
    ;(grid.current?.children[next] as HTMLElement | undefined)?.focus()
  }
  return (
    <div className="flex flex-col gap-3">
      <p id="tarot-cut-prompt" className="m-0 text-center text-ink-muted text-sm">
        {m.tarot_cut_prompt()}
      </p>
      <div
        ref={grid}
        data-testid="tarot-cut-spread"
        className={cn(
          'mx-auto grid w-full max-w-[720px] auto-rows-[44px] grid-cols-8 pb-[34px] sm:auto-rows-[48px] sm:grid-cols-13 sm:pb-[48px]',
          enter,
          entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        )}
      >
        {Array.from({ length: 78 }, (_, index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 位置即切牌点
            key={index}
            type="button"
            tabIndex={index === focus ? 0 : -1}
            aria-label={m.tarot_cut_card({ n: index + 1 })}
            aria-describedby={index === focus ? 'tarot-cut-prompt' : undefined}
            onClick={() => onCut(index)}
            onKeyDown={(event) => move(event, index)}
            onFocus={() => setFocus(index)}
            className="group relative min-w-0 rounded-[10px] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <span className="absolute inset-x-0.5 top-0 block aspect-[0.58] transition-transform duration-200 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 motion-reduce:transition-none">
              <CardBack className="shadow-[0_-2px_6px_rgba(0,0,0,0.25)]" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 单个牌位：未翻开时是按钮（键盘可选），翻开时 3D 翻转；减少动态效果时改为交叉淡入 */
function Slot({
  card,
  position,
  index,
  revealed,
  locale,
  label,
  onReveal,
}: {
  /** 未发牌时为空：只显示牌位与牌背占位 */
  card?: DrawnCard | undefined
  position: Position
  index: number
  revealed: boolean
  locale: TarotLocale
  label: 'above' | 'badge'
  onReveal: (index: number) => void
}) {
  const entered = useEntered()
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-2',
        enter,
        entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
      data-testid="tarot-slot"
      data-revealed={revealed}
    >
      {label === 'above' && (
        <span className="text-center text-ink-subtle text-xs uppercase tracking-[1px]">
          {position.name}
        </span>
      )}
      <div className="relative aspect-[0.58] w-full perspective-[900px]">
        <div
          className={cn(
            'relative size-full transition-transform duration-500 ease-out transform-3d motion-reduce:transition-none',
            revealed && 'rotate-y-180 motion-reduce:rotate-y-0',
          )}
        >
          {!card && <CardBack className="opacity-60" />}
          {card && (
            <button
              type="button"
              disabled={revealed}
              aria-label={m.tarot_reveal_card({ position: position.name })}
              onClick={() => onReveal(index)}
              data-slot-index={index}
              className={cn(
                'absolute inset-0 cursor-pointer rounded-[10px] backface-hidden transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default',
                revealed && 'motion-reduce:opacity-0',
              )}
            >
              <CardBack />
            </button>
          )}
          <div
            className={cn(
              'pointer-events-none absolute inset-0 rotate-y-180 backface-hidden transition-opacity duration-300 motion-reduce:rotate-y-0',
              !revealed && 'motion-reduce:opacity-0',
            )}
          >
            {revealed && card && <CardFace card={card} locale={locale} />}
          </div>
        </div>
        {label === 'badge' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 left-1 z-10 flex size-6 items-center justify-center rounded-full border border-line-strong bg-surface text-ink text-xs"
          >
            {index + 1}
          </span>
        )}
      </div>
    </div>
  )
}

// 凯尔特十字：左侧十字（3×3，牌 2 横压在牌 1 上并略下移，保证牌 1 上端露出 ≥44px 可点区域），右侧自下而上 7–10。
// 网格 8 个半行，每张牌跨两行，十字整体相对右列居中。
const CELTIC_AREAS = [
  'col-start-2 row-start-4 row-span-2',
  'col-start-2 row-start-4 row-span-2 z-10 rotate-90 translate-y-[14%]',
  'col-start-2 row-start-6 row-span-2',
  'col-start-1 row-start-4 row-span-2',
  'col-start-2 row-start-2 row-span-2',
  'col-start-3 row-start-4 row-span-2',
  'col-start-4 row-start-7 row-span-2',
  'col-start-4 row-start-5 row-span-2',
  'col-start-4 row-start-3 row-span-2',
  'col-start-4 row-start-1 row-span-2',
] as const

/** 牌阵桌面：按牌阵排布已发出的牌；洗牌前 cards 为空，显示牌位占位 */
export function SpreadTable({
  spread,
  cards,
  positions,
  revealed,
  locale,
  onReveal,
}: {
  spread: SpreadId
  cards: readonly DrawnCard[]
  positions: readonly Position[]
  revealed: readonly boolean[]
  locale: TarotLocale
  onReveal: (index: number) => void
}) {
  const slot = (index: number, label: 'above' | 'badge', className?: string) => {
    const card = cards[index]
    const position = positions[index]
    if (!position) return null
    // 牌阵位置放在外层，入场动画的 transform 留给牌位自身
    return (
      <div key={card?.cardId ?? index} className={cn('min-w-0', className)}>
        <Slot
          card={card}
          position={position}
          index={index}
          revealed={revealed[index] ?? false}
          locale={locale}
          label={label}
          onReveal={onReveal}
        />
      </div>
    )
  }
  if (spread === 'celtic-cross')
    return (
      <div className="mx-auto grid w-full max-w-[560px] grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1fr)] grid-rows-8 gap-x-2 gap-y-1 [&>*:nth-child(n+7)]:ml-2 sm:gap-x-4">
        {positions.map((_, index) => slot(index, 'badge', CELTIC_AREAS[index]))}
      </div>
    )
  if (positions.length === 1) return <div className="mx-auto w-40 sm:w-48">{slot(0, 'above')}</div>
  return (
    <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-2.5 sm:gap-5">
      {positions.map((_, index) => slot(index, 'above'))}
    </div>
  )
}
