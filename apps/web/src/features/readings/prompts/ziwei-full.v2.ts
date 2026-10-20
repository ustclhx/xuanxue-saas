import { ZIWEI_FULL_V1 } from './ziwei-full.v1.ts'

/**
 * 紫微斗數详批（繁中）提示词 v2：沿用 v1 全文，追加 5.1 staging 抽检发现的用字约束
 * （夹杂简体字）。system 仍固定，前缀缓存不受影响。
 */
export const ZIWEI_FULL_V2 = {
  ...ZIWEI_FULL_V1,
  version: 'ziwei-full.v2',
  system: `${ZIWEI_FULL_V1.system}

## 用字與資料一致（必須遵守）
- 只使用台灣慣用的繁體字，不得夾雜任何簡體字，也不要夾雜英文單字。容易寫錯的字例如：與、後、點、話、認、換、願、邊、鬆（放鬆）。
- 星曜、四化與宮位的敘述必須與 JSON 一致，不要寫出資料中沒有的星曜或四化。`,
} as const
