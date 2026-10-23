import type { LocalRates } from './price.ts'

/**
 * Exchange Rate API 的署名（服务条款要求）：仅在展示实时汇率的「约」值时出现；
 * 署名文字由服务端随汇率一起返回，参考值为 null 时不显示。
 */
export function FxAttribution({
  attribution,
  className = '',
}: {
  attribution: NonNullable<LocalRates['attribution']>
  className?: string
}) {
  return (
    <a
      href={attribution.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs underline underline-offset-2 ${className}`}
    >
      {attribution.text}
    </a>
  )
}
