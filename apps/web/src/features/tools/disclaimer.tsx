import { cn } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'

/**
 * 合规声明（specs/tool-pages「合规声明」）按场景拆分：
 * - 免费工具与免费结果：依传统规则计算、仅供娱乐、不预测未来，不得声称 AI 生成或 AI 辅助；
 * - AI 详批解锁卡、报告、定价页、Chat：AI 辅助、仅供娱乐、不预测未来。
 * 两者都引导健康问题寻求专业医疗建议。视觉规范：结果区底部的浅色条（--surface-2）。
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

/** AI 产物的声明；`className` 供反色卡片等场景覆盖默认浅色条样式 */
export function AiDisclaimer({ className }: { className?: string }) {
  return (
    <p
      role="note"
      aria-label={m.tools_disclaimer_label()}
      data-testid="ai-disclaimer"
      className={cn(
        'm-0 rounded-lg bg-surface-2 px-4 py-3.5 text-ink-muted text-sm leading-relaxed',
        className,
      )}
    >
      {m.tools_ai_disclaimer()}
    </p>
  )
}
