import { NUMEROLOGY_FULL_V2 } from './numerology-full.v2.ts'

/** Personal Year 与 Life Path 统一分别归约口径；保留旧版本供已生成报告追溯。 */
export const NUMEROLOGY_FULL_V3 = {
  ...NUMEROLOGY_FULL_V2,
  version: 'numerology-full.v3',
  system: `${NUMEROLOGY_FULL_V2.system}

## Personal Year calculation
- personalYear is computed by reducing the birth month, birth day and currentYear separately, adding those three reduced values, then reducing the total. Preserve 11, 22 and 33 at every reduction, including the total.
- Use the server-computed personalYear.value exactly. Do not replace a supplied master number with its single digit or recalculate it by adding the unreduced calendar values.`,
} as const
