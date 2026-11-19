/**
 * 营销页与工具页上的按钮样式（设计稿 docs/design/prototypes/warm-refresh/site.css 的 .btn）：
 * 药丸形、48px 高、正文字号 500 字重；主按钮为文字色填充，次按钮为 field-border 细框。
 * 应用区按钮沿用模板形状，不用这里的类。
 *
 * 打印：浏览器默认不输出背景色，主按钮的浅色文字会印在白纸上看不见，打印时改为描边加墨色文字。
 */
const base =
  'inline-flex min-h-12 items-center justify-center rounded-full px-7 font-medium text-body no-underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-60'

export const primaryButton = `${base} bg-brand text-on-brand transition-opacity hover:opacity-90 print:bg-transparent print:text-ink print:ring-1 print:ring-field-border print:ring-inset`

export const secondaryButton = `${base} bg-transparent text-ink ring-1 ring-field-border ring-inset transition-colors hover:bg-surface-2`

/** 文字链接：与正文同色，靠下划线区分（brand.css 给 text-brand-ink 的 a / button 加下划线），点击区 ≥ 44px */
export const textLink = 'inline-flex min-h-11 items-center text-body text-brand-ink'
