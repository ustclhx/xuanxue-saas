import type { SpreadId, Suit } from '@xuanxue/tarot'
import { m } from '../../../paraglide/messages.js'

type Message = () => string

/** 每个牌阵页的文案：H1、导语、互导链接名称、6 条问句模板与 3 条 FAQ（messages/<locale>/tarot.json） */
export interface SpreadCopy {
  readonly h1: Message
  readonly intro: Message
  readonly link: Message
  readonly templates: readonly Message[]
  readonly faq: readonly (readonly [Message, Message])[]
}

export const SPREAD_COPY: Readonly<Record<SpreadId, SpreadCopy>> = {
  'three-card': {
    h1: m.tarot_three_card_h1,
    intro: m.tarot_three_card_intro,
    link: m.tarot_three_card_link,
    templates: [
      m.tarot_three_card_template_1,
      m.tarot_three_card_template_2,
      m.tarot_three_card_template_3,
      m.tarot_three_card_template_4,
      m.tarot_three_card_template_5,
      m.tarot_three_card_template_6,
    ],
    faq: [
      [m.tarot_three_card_faq_1_q, m.tarot_three_card_faq_1_a],
      [m.tarot_three_card_faq_2_q, m.tarot_three_card_faq_2_a],
      [m.tarot_three_card_faq_3_q, m.tarot_three_card_faq_3_a],
    ],
  },
  daily: {
    h1: m.tarot_daily_h1,
    intro: m.tarot_daily_intro,
    link: m.tarot_daily_link,
    templates: [
      m.tarot_daily_template_1,
      m.tarot_daily_template_2,
      m.tarot_daily_template_3,
      m.tarot_daily_template_4,
      m.tarot_daily_template_5,
      m.tarot_daily_template_6,
    ],
    faq: [
      [m.tarot_daily_faq_1_q, m.tarot_daily_faq_1_a],
      [m.tarot_daily_faq_2_q, m.tarot_daily_faq_2_a],
      [m.tarot_daily_faq_3_q, m.tarot_daily_faq_3_a],
    ],
  },
  'yes-or-no': {
    h1: m.tarot_yes_or_no_h1,
    intro: m.tarot_yes_or_no_intro,
    link: m.tarot_yes_or_no_link,
    templates: [
      m.tarot_yes_or_no_template_1,
      m.tarot_yes_or_no_template_2,
      m.tarot_yes_or_no_template_3,
      m.tarot_yes_or_no_template_4,
      m.tarot_yes_or_no_template_5,
      m.tarot_yes_or_no_template_6,
    ],
    faq: [
      [m.tarot_yes_or_no_faq_1_q, m.tarot_yes_or_no_faq_1_a],
      [m.tarot_yes_or_no_faq_2_q, m.tarot_yes_or_no_faq_2_a],
      [m.tarot_yes_or_no_faq_3_q, m.tarot_yes_or_no_faq_3_a],
    ],
  },
  'celtic-cross': {
    h1: m.tarot_celtic_cross_h1,
    intro: m.tarot_celtic_cross_intro,
    link: m.tarot_celtic_cross_link,
    templates: [
      m.tarot_celtic_cross_template_1,
      m.tarot_celtic_cross_template_2,
      m.tarot_celtic_cross_template_3,
      m.tarot_celtic_cross_template_4,
      m.tarot_celtic_cross_template_5,
      m.tarot_celtic_cross_template_6,
    ],
    faq: [
      [m.tarot_celtic_cross_faq_1_q, m.tarot_celtic_cross_faq_1_a],
      [m.tarot_celtic_cross_faq_2_q, m.tarot_celtic_cross_faq_2_a],
      [m.tarot_celtic_cross_faq_3_q, m.tarot_celtic_cross_faq_3_a],
    ],
  },
}

export function answerLabel(answer: 'Yes' | 'No' | 'Maybe'): string {
  if (answer === 'Yes') return m.tarot_answer_yes()
  if (answer === 'No') return m.tarot_answer_no()
  return m.tarot_answer_maybe()
}

export function orientationLabel(reversed: boolean): string {
  return reversed ? m.tarot_reversed() : m.tarot_upright()
}

/** 牌义索引的分组名：大阿尔卡那与四个花色（花色名只是「权杖」一词，标题另加「牌组」） */
export const GROUP_NAME: Readonly<Record<Suit, Message>> = {
  major: m.tarot_group_major,
  wands: m.tarot_group_wands,
  cups: m.tarot_group_cups,
  swords: m.tarot_group_swords,
  pentacles: m.tarot_group_pentacles,
}

/** 分组标题旁的一行说明：张数、元素与主题 */
export const GROUP_NOTE: Readonly<Record<Suit, Message>> = {
  major: m.tarot_group_major_note,
  wands: m.tarot_group_wands_note,
  cups: m.tarot_group_cups_note,
  swords: m.tarot_group_swords_note,
  pentacles: m.tarot_group_pentacles_note,
}
