import { cn } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'

/**
 * 合规声明（specs/tool-pages「合规声明」）按场景拆分：
 * - 免费工具与免费结果：依传统规则计算、仅供参考与潜意识探索、不预测未来，不得声称 AI 生成或 AI 辅助；
 * - AI 详批解锁卡、报告、定价页、Chat：依传统方法推算、AI 辅助解读、仅供参考与潜意识探索、不预测未来。
 * 两者都引导健康问题寻求专业医疗建议。
 * 样式为 caption 小字、不加底色（openspec refresh-visual-system-warm design.md D9）：放在结果区底部、
 * 样例报告下方与页脚，不以整宽色条打断阅读流。
 */
const disclaimerText = 'm-0 max-w-180 text-caption text-ink-subtle'

export function Disclaimer() {
  return (
    <p role="note" aria-label={m.tools_disclaimer_label()} className={disclaimerText}>
      {m.tools_disclaimer()}
    </p>
  )
}

/** AI 产物的声明；`className` 供反色卡片等场景覆盖默认文字色 */
export function AiDisclaimer({ className }: { className?: string }) {
  return (
    <p
      role="note"
      aria-label={m.tools_disclaimer_label()}
      data-testid="ai-disclaimer"
      className={cn(disclaimerText, className)}
    >
      {m.tools_ai_disclaimer()}
    </p>
  )
}
