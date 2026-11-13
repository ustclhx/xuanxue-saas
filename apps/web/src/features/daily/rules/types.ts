import type { DailyRelationKind, DutyKey, PillarKey, TenGod } from '@xuanxue/bazi'

/**
 * 每日规则文案表（add-birth-profiles-daily-horoscope tasks 7.1）。
 *
 * 每条事实对应「主题 + 建议 + 留意」三段（design D6「不打分」），用反思与建议的语气，
 * 不写吉凶断语，不预测具体事件或月日，不给医疗、投资、法律方面的确定性建议，不提 AI。
 * 同一类事实准备多条，按日期确定性轮换（copy.ts）。文案改动时递增 DAILY_COPY_VERSION。
 */
export const DAILY_COPY_VERSION = '1.0.0'

export interface DailyTip {
  /** 主题：一句话概括今天的气氛 */
  readonly theme: string
  /** 建议：可以做的小事 */
  readonly advice: string
  /** 留意：需要放慢或多想一步的地方 */
  readonly caution: string
}

/** 东方站（繁中、简中、韩语）：十神提示、地支关系、建除与宜忌词条 */
export interface EastRules {
  readonly locale: 'zh-Hant' | 'zh-Hans' | 'ko'
  /** 今日日干相对日主的十神，每个十神至少 3 条 */
  readonly tenGod: Readonly<Record<TenGod, readonly DailyTip[]>>
  /** 十神的一句话关键词（日主选择区块的副标题） */
  readonly tenGodKeyword: Readonly<Record<TenGod, string>>
  /** 本命各柱地支的称呼（「年支」「日支」），填入关系提示的 `{pillar}` */
  readonly pillar: Readonly<Record<PillarKey, string>>
  /** 关系名（「沖」「合」「半合」「刑」「害」），与两个地支拼成「辰戌沖」 */
  readonly relationName: Readonly<Record<DailyRelationKind, string>>
  /** 日支与本命某支有关系时的提示，`{pillar}` 替换为「年支 / 月支 / 日支 / 时支」，每类至少 2 条 */
  readonly relation: Readonly<Record<DailyRelationKind, readonly string[]>>
  /** 与本命各支都没有冲合刑害时的提示 */
  readonly noRelation: readonly string[]
  /** 建除十二值星：名称与释义 */
  readonly duty: Readonly<Record<DutyKey, { readonly name: string; readonly gloss: string }>>
  /**
   * 黄历宜忌词条名称，下标即 tyme4ts Taboo 序号（共 140 项）。
   * 释义只覆盖常见词条（`tabooGloss`），其余只显示名称。
   */
  readonly taboo: readonly string[]
  readonly tabooGloss: Readonly<Partial<Record<number, string>>>
}

/** 西方站（英语）：宇宙日与个人日 1–9、11、22 的含义 */
export type DailyNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 22

export const DAILY_NUMBERS: readonly DailyNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22]

export interface WestRules {
  readonly locale: 'en'
  readonly number: Readonly<
    Record<
      DailyNumber,
      {
        /** 关键词（如 “Beginnings”） */
        readonly keyword: string
        /** 个人日的含义，每个数字至少 2 条 */
        readonly personal: readonly DailyTip[]
        /** 宇宙日（所有人共享）的气氛，每个数字至少 2 条 */
        readonly universal: readonly string[]
      }
    >
  >
}

/**
 * 不展示的宜忌词条：求医、治病、针灸、求医疗病（医疗）与词讼（法律）会被读成就医或诉讼建议，
 * 「诸事不宜」「馀事勿取」是吉凶断语（daily-horoscope spec「每日内容合规」）。
 */
export const HIDDEN_TABOOS: ReadonlySet<number> = new Set([111, 123, 124, 125, 134, 135, 136])
