import {
  type AnySpreadId,
  cutDeck,
  type DrawnCard,
  decodeReading,
  drawCards,
  encodeReading,
  type Reading,
  shuffleDeck,
} from '@xuanxue/tarot'
import { useEffect, useRef, useState } from 'react'
import { readShareFragment, shareUrl } from '../share.ts'
import { prefetchCards } from './card.tsx'
import { type Stage, useShuffleFrames } from './table.tsx'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** 分享片段中的抽牌结果；牌阵与当前页面不一致或内容非法时视为无效 */
export function sharedReading<S extends AnySpreadId>(
  hash: string,
  spread: S,
): Reading<S> | 'invalid' | null {
  const shared = readShareFragment(hash)
  if (!shared) return hash.includes('r=') ? 'invalid' : null
  try {
    return decodeReading(String(shared.reading ?? ''), spread)
  } catch {
    return 'invalid'
  }
}

/**
 * 牌阵页的抽牌流程（洗牌 → 铺牌切牌 → 翻牌），通用牌阵页与主题牌阵页共用：
 * 洗牌与抽牌只在浏览器中进行（加密随机数）；打开分享链接时直接显示同一组牌；全部翻开后结果写入 `#r=` 片段，
 * 阅读牌义后用浏览器后退返回，页面会恢复同一组牌。
 */
export function useSpreadDraw<S extends AnySpreadId>(spread: S) {
  const [stage, setStage] = useState<Stage>('ready')
  const [deck, setDeck] = useState<DrawnCard[] | null>(null)
  const [reading, setReading] = useState<Reading<S> | null>(null)
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

  const shuffle = (reversals: boolean) => {
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

  const revealAll = () => {
    if (reading) setRevealed(reading.cards.map(() => true))
  }

  const complete = reading !== null && revealed.length > 0 && revealed.every(Boolean)

  // 结果写入 `#r=` 片段（与分享链接同格式）
  useEffect(() => {
    if (!complete || !reading) return
    window.history.replaceState(
      window.history.state,
      '',
      shareUrl(window.location.href, { reading: encodeReading(reading) }),
    )
  }, [complete, reading])

  return {
    stage,
    reading,
    revealed,
    shared,
    hydrated,
    table,
    frame,
    complete,
    shuffle,
    cut,
    reveal,
    revealAll,
  }
}
