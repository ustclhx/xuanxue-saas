import type { compatibility } from '@xuanxue/numerology'
import { m } from '../../../paraglide/messages.js'
import type { ToolLink } from '../tool-links.tsx'
import {
  LIFE_PATH_TOOL_PATH,
  type LifePathValue,
  NUMEROLOGY_TOOLS,
  type NumerologyToolId,
} from './routes.ts'

export type CompatibilityLevel = ReturnType<typeof compatibility>['level']

// 按数字取文案：显式映射，保持文案键可被类型检查与 Paraglide 按需打包
export const NUMBER_SUMMARY: Record<LifePathValue, () => string> = {
  1: m.numerology_summary_1,
  2: m.numerology_summary_2,
  3: m.numerology_summary_3,
  4: m.numerology_summary_4,
  5: m.numerology_summary_5,
  6: m.numerology_summary_6,
  7: m.numerology_summary_7,
  8: m.numerology_summary_8,
  9: m.numerology_summary_9,
  11: m.numerology_summary_11,
  22: m.numerology_summary_22,
  33: m.numerology_summary_33,
}

export const NUMBER_THEME: Record<LifePathValue, () => string> = {
  1: m.numerology_theme_1,
  2: m.numerology_theme_2,
  3: m.numerology_theme_3,
  4: m.numerology_theme_4,
  5: m.numerology_theme_5,
  6: m.numerology_theme_6,
  7: m.numerology_theme_7,
  8: m.numerology_theme_8,
  9: m.numerology_theme_9,
  11: m.numerology_theme_11,
  22: m.numerology_theme_22,
  33: m.numerology_theme_33,
}

export const LEVEL_LABEL: Record<CompatibilityLevel, () => string> = {
  high: m.numerology_compat_level_high,
  medium: m.numerology_compat_level_medium,
  challenging: m.numerology_compat_level_challenging,
}

export const LEVEL_EXPLAIN: Record<
  CompatibilityLevel,
  (inputs: { left: string; right: string; leftTheme: string; rightTheme: string }) => string
> = {
  high: m.numerology_compat_explain_high,
  medium: m.numerology_compat_explain_medium,
  challenging: m.numerology_compat_explain_challenging,
}

/** 结果中的数字一定是生命灵数取值之一（1–9、11、22、33） */
export function asLifePath(value: number): LifePathValue {
  return value as LifePathValue
}

/** 数字命理工具与枢纽页的内链矩阵；`current` 为当前页 id，不链接自身 */
export function numerologyLinks(current?: string): ToolLink[] {
  const links: ToolLink[] = [
    { href: LIFE_PATH_TOOL_PATH, title: m.numerology_home_title(), target: 'life-path' },
    {
      href: NUMEROLOGY_TOOLS['numerology-calculator'].path,
      title: m.numerology_link_calculator(),
      target: 'numerology-calculator',
    },
    {
      href: NUMEROLOGY_TOOLS['numerology-chart'].path,
      title: m.numerology_link_chart(),
      target: 'numerology-chart',
    },
    {
      href: NUMEROLOGY_TOOLS['name-numerology'].path,
      title: m.numerology_link_name(),
      target: 'name-numerology',
    },
    {
      href: NUMEROLOGY_TOOLS['life-path-compatibility'].path,
      title: m.numerology_link_compatibility(),
      target: 'life-path-compatibility',
    },
    { href: '/soul-urge-number', title: m.numerology_link_soul_urge(), target: 'soul-urge-number' },
    { href: '/destiny-number', title: m.numerology_link_destiny(), target: 'destiny-number' },
  ]
  return links.filter((link) => link.target !== current)
}

/**
 * 四个工具内页页尾的相关工具：每页只列语义上最接近的 3–4 个（内链规则：每页正文链接 2–5 条、只链接相关页面），
 * 不再把全部工具排成一行。Life Path 工具页（父页）仍用 numerologyLinks 的完整列表。
 */
const RELATED_TOOLS: Readonly<Record<NumerologyToolId, readonly string[]>> = {
  // 计算器结果含 Expression（Destiny）数；钱页 /destiny-number 由此补足站内入链（openspec seo-fix-tdk-links 决策 6）
  'numerology-calculator': ['life-path', 'numerology-chart', 'name-numerology', 'destiny-number'],
  'numerology-chart': ['numerology-calculator', 'life-path', 'name-numerology'],
  'name-numerology': ['destiny-number', 'soul-urge-number', 'numerology-calculator'],
  'life-path-compatibility': ['life-path', 'numerology-calculator', 'numerology-chart'],
}

export function relatedNumerologyLinks(id: NumerologyToolId): ToolLink[] {
  const links = numerologyLinks(id)
  return RELATED_TOOLS[id].flatMap((target) => links.find((link) => link.target === target) ?? [])
}

/**
 * 数字页正文里链接的相邻数字（使用者 2026-11-19 确认：每页 2–3 个，写在句子里，不再放 12 个数字的网格）：
 * 1–9 首尾相接取前后各一个；大师数取另外两个大师数，再加它约简后的根数（11→2、22→4、33→6）。
 */
export function neighborNumbers(value: LifePathValue): {
  readonly pair: readonly [LifePathValue, LifePathValue]
  readonly root?: LifePathValue
} {
  if (value > 9) {
    const masters = ([11, 22, 33] as const).filter((master) => master !== value)
    return {
      pair: [masters[0] as LifePathValue, masters[1] as LifePathValue],
      root: asLifePath((value / 11) * 2),
    }
  }
  return { pair: [asLifePath(((value + 7) % 9) + 1), asLifePath((value % 9) + 1)] }
}

/** 四个工具内页的 FAQ（页面 ToolFaq 与 FAQPage 共用） */
export function toolFaq(id: NumerologyToolId): { question: string; answer: string }[] {
  const pairs: Record<NumerologyToolId, [() => string, () => string][]> = {
    'numerology-calculator': [
      [m.numerology_faq_calc_q1, m.numerology_faq_calc_a1],
      [m.numerology_faq_calc_q2, m.numerology_faq_calc_a2],
      [m.numerology_faq_calc_q3, m.numerology_faq_calc_a3],
    ],
    'numerology-chart': [
      [m.numerology_faq_chart_q1, m.numerology_faq_chart_a1],
      [m.numerology_faq_chart_q2, m.numerology_faq_chart_a2],
    ],
    'name-numerology': [
      [m.numerology_faq_name_q1, m.numerology_faq_name_a1],
      [m.numerology_faq_name_q2, m.numerology_faq_name_a2],
    ],
    'life-path-compatibility': [
      [m.numerology_faq_compat_q1, m.numerology_faq_compat_a1],
      [m.numerology_faq_compat_q2, m.numerology_faq_compat_a2],
    ],
  }
  return pairs[id].map(([question, answer]) => ({ question: question(), answer: answer() }))
}
