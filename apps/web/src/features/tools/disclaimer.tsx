import { m } from '../../paraglide/messages.js'

/**
 * 合规声明（specs/tool-pages「合规声明」）：AI 辅助、仅供娱乐、不预测未来，并引导健康问题寻求专业医疗建议。
 * 视觉规范：结果区底部的浅色条（--surface-2）。文案随当前语言（en / zh-Hant / ko）。
 */
export function Disclaimer() {
  return (
    <p
      role="note"
      aria-label={m.tools_disclaimer_label()}
      className="m-0 rounded-lg bg-surface-2 px-4 py-3.5 text-ink-muted text-sm leading-relaxed"
    >
      {m.tools_disclaimer()}
    </p>
  )
}
