import type { Branch, Stem } from '@xuanxue/bazi'
import { m } from '../../paraglide/messages.js'
import { BRANCH_HANZI, ganzhi, ganzhiHangul, STEM_HANZI } from '../tools/bazi/glyphs.ts'
import type { ChatContext } from './chat-context.ts'

/**
 * 对话页首条消息前的上下文摘要：只挑几项最能辨认「是哪一张盘」的结论，完整结果在提示词里。
 * 干支用汉字（韩语用한글读音），塔罗牌名在复算时已是报告语言。
 */
export interface ContextSummaryItem {
  readonly label: string
  readonly value: string
}

type Pillar = { stem: Stem; branch: Branch } | null | undefined
type Pillars = Partial<Record<'year' | 'month' | 'day' | 'hour', Pillar>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validPillar = (pillar: Pillar): pillar is { stem: Stem; branch: Branch } =>
  Boolean(pillar && pillar.stem in STEM_HANZI && pillar.branch in BRANCH_HANZI)

function pillarsText(chart: unknown, locale: string): string | null {
  if (!isRecord(chart) || !isRecord(chart.pillars)) return null
  const pillars = chart.pillars as Pillars
  const format = locale === 'ko' ? ganzhiHangul : ganzhi
  const parts = (['year', 'month', 'day', 'hour'] as const).map((key) => {
    const pillar = pillars[key]
    return validPillar(pillar) ? format(pillar.stem, pillar.branch) : '—'
  })
  return parts.every((part) => part === '—') ? null : parts.join(' · ')
}

const numberValue = (value: unknown): string | null =>
  isRecord(value) && typeof value.value === 'number' ? String(value.value) : null

function push(items: ContextSummaryItem[], label: string, value: string | null) {
  if (value) items.push({ label, value })
}

export function contextSummary(context: ChatContext, locale: string): ContextSummaryItem[] {
  const { result } = context
  const items: ContextSummaryItem[] = []
  switch (context.kind) {
    case 'bazi-full':
    case 'saju-full':
      push(items, m.ai_chat_context_pillars(), pillarsText(result, locale))
      break
    case 'saju-compat':
      push(items, m.ai_chat_context_pillars_a(), pillarsText(result.a, locale))
      push(items, m.ai_chat_context_pillars_b(), pillarsText(result.b, locale))
      if (isRecord(result.compatibility) && typeof result.compatibility.score === 'number')
        push(items, m.ai_chat_context_score(), String(result.compatibility.score))
      break
    case 'ziwei-full': {
      const palaces = Array.isArray(result.palaces) ? result.palaces : []
      const soul = palaces.find((p) => isRecord(p) && p.key === 'soul') as Pillar
      push(
        items,
        m.ai_chat_context_soul_palace(),
        validPillar(soul)
          ? (locale === 'ko' ? ganzhiHangul : ganzhi)(soul.stem, soul.branch)
          : null,
      )
      break
    }
    case 'numerology-full':
      push(items, m.ai_chat_context_life_path(), numberValue(result.lifePath))
      push(items, m.ai_chat_context_personal_year(), numberValue(result.personalYear))
      break
    case 'tarot-spread': {
      const cards = Array.isArray(result.cards)
        ? result.cards.flatMap((card) => (isRecord(card) ? [card] : []))
        : []
      push(
        items,
        m.ai_chat_context_cards(),
        cards
          .map((card) =>
            typeof card.card === 'string'
              ? card.reversed === true
                ? m.ai_chat_context_reversed({ card: card.card })
                : card.card
              : null,
          )
          .filter(Boolean)
          .join(' · ') || null,
      )
      if (typeof result.question === 'string' && result.question)
        push(items, m.ai_chat_context_question(), result.question)
      break
    }
  }
  return items
}
