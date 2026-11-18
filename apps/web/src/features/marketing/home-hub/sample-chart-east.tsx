import type { PillarKey } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { m } from '../../../paraglide/messages.js'
import {
  BRANCH_ELEMENT,
  BRANCH_HANZI,
  ELEMENT_BG,
  STEM_ELEMENT,
  STEM_HANZI,
} from '../../tools/bazi/glyphs.ts'
import { ELEMENT_LABEL, PILLAR_LABEL } from '../../tools/bazi/labels.ts'
import { SAMPLE_BAZI_PILLARS } from '../../tools/charts/samples.ts'

const ORDER: readonly PillarKey[] = ['year', 'month', 'day', 'hour']

/**
 * 东方站首页样例命盘（设计稿 warm-refresh/Main.dc.html「樣例命盤」）：固化的虚构命盘，四柱各一格，
 * 干支为 title 字号，五行以圆点加文字标注（颜色只作辅助），日柱用强调色细框。
 * 静态预渲染，不加载排盘引擎与图形布局代码。
 */
export function EastSampleChart() {
  return (
    <div data-sample-chart="pillars" className="grid grid-cols-4 gap-3">
      {ORDER.map((key) => {
        const pillar = SAMPLE_BAZI_PILLARS[key]
        if (!pillar) return null
        const isDay = key === 'day'
        const glyphs = [
          { part: 'stem', glyph: STEM_HANZI[pillar.stem], element: STEM_ELEMENT[pillar.stem] },
          {
            part: 'branch',
            glyph: BRANCH_HANZI[pillar.branch],
            element: BRANCH_ELEMENT[pillar.branch],
          },
        ]
        return (
          <div
            key={key}
            data-pillar={key}
            className={cn(
              'flex flex-col items-center gap-1 rounded-field bg-surface-2 px-1 py-3',
              isDay && 'inset-ring inset-ring-mark',
            )}
          >
            <span className="text-center text-caption text-ink-subtle">
              {/* 手机上四格各约 66px：日柱只写「日主」，避免标签折成两行使四柱错位 */}
              {isDay ? (
                <>
                  <span className="max-sm:hidden">{PILLAR_LABEL[key]()} · </span>
                  {m.bazi_day_master()}
                </>
              ) : (
                PILLAR_LABEL[key]()
              )}
            </span>
            {glyphs.map(({ part, glyph, element }) => (
              <span key={part} className="contents">
                <span className="font-heading text-ink text-title">{glyph}</span>
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 shrink-0 rounded-full', ELEMENT_BG[element])}
                  />
                  {ELEMENT_LABEL[element]()}
                </span>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
