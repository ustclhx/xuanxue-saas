import { NUMEROLOGY_FULL_V1 } from './numerology-full.v1.ts'

/**
 * Numerology full reading (English) prompt v2：沿用 v1 全文，追加 5.1 staging 抽检发现的约束
 * （把约简后的 birthday 数误写成出生日）。system 仍固定，前缀缓存不受影响。
 */
export const NUMEROLOGY_FULL_V2 = {
  ...NUMEROLOGY_FULL_V1,
  version: 'numerology-full.v2',
  system: `${NUMEROLOGY_FULL_V1.system}

## Accuracy (must follow)
- birthday.value is the reduced birthday number, not the calendar day of birth. Never state or imply which day of the month the reader was born on (for example, do not write "people born on the 2nd").
- Every number you mention must match the JSON exactly.`,
} as const
