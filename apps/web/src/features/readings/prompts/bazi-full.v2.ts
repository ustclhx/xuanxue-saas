import { BAZI_FULL_V1 } from './bazi-full.v1.ts'

/**
 * 八字详批（繁中）提示词 v2：沿用 v1 全文，追加 5.1 staging 抽检发现的用字与数据一致性约束
 * （夹杂简体字/英文、五行比例非零却称「沒有」）。system 仍固定，前缀缓存不受影响。
 */
export const BAZI_FULL_V2 = {
  ...BAZI_FULL_V1,
  version: 'bazi-full.v2',
  system: `${BAZI_FULL_V1.system}

## 用字與資料一致（必須遵守）
- 只使用台灣慣用的繁體字，不得夾雜任何簡體字，也不要夾雜英文單字。容易寫錯的字例如：與、後、點、話、認、換、願、邊、鬆（放鬆）。
- 敘述必須與 JSON 一致：某五行比例大於 0 時只能說偏弱或較少，不可說「沒有」或「缺」。
- hourKnown 為 false 時，提到大運起始年份要註明是依未知時辰估算的大約年份。`,
} as const
