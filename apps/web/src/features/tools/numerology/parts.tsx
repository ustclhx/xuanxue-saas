import type { BirthDate, NumberResult } from '@xuanxue/numerology'
import { cn } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { m } from '../../../paraglide/messages.js'
import { RichContent } from '../../marketing/rich-content.tsx'
import { useTool } from '../context.tsx'
import { formatLongDate, lifePathLines } from './calc.ts'
import { asLifePath, NUMBER_SUMMARY } from './copy.ts'
import { LIFE_PATH_NUMBERS, lifePathPath } from './routes.ts'

/** 西方站的大号数字（原型：Cormorant 112px、星金色），手机上缩小以免挤压步骤 */
export function BigNumber({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn('font-heading text-[88px] text-brand leading-[0.9] sm:text-[112px]', className)}
    >
      {value}
    </span>
  )
}

export function MasterPill() {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-brand px-3 text-[13px] text-brand">
      {m.numerology_master()}
    </span>
  )
}

/** 数字 + 大师数胶囊 */
export function NumberHeadline({ result, size }: { result: NumberResult; size?: 'sm' }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <BigNumber
        value={result.value}
        className={size === 'sm' ? 'text-[64px] sm:text-[72px]' : ''}
      />
      {result.master && <MasterPill />}
    </div>
  )
}

/** 算式行：等宽数字，长算式在窄屏上折行而不是撑出横向滚动 */
export function StepLines({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col text-[15px] text-ink-muted tabular-nums leading-[1.8] [overflow-wrap:anywhere]">
      {children}
    </div>
  )
}

export function LifePathSteps({ result, date }: { result: NumberResult; date: BirthDate }) {
  const label = {
    month: m.numerology_step_month(),
    day: m.numerology_step_day(),
    year: m.numerology_step_year(),
  }
  return (
    <StepLines>
      {lifePathLines(result, date).map((line) =>
        line.phase === 'total' ? (
          <div key={line.phase} className="text-ink">
            {line.text.replace(/\d+$/, '')}
            <strong>{result.value}</strong>
          </div>
        ) : (
          <div key={line.phase}>
            {label[line.phase]} {line.input} → {line.text}
            {line.kept && ` ${m.numerology_step_kept()}`}
          </div>
        ),
      )}
    </StepLines>
  )
}

/**
 * 首页结果卡（原型 LifePath.dc.html 右栏）：标签、大号数字、大师数、算式、摘要、数字页链接与短声明。
 * `example` 时标签改为样例说明（首屏未提交前展示 1987-11-29 的计算过程）。
 */
export function LifePathCard({
  result,
  date,
  example,
  footer,
}: {
  result: NumberResult
  date: BirthDate
  example?: boolean
  footer?: ReactNode
}) {
  const labelId = useId()
  const { track } = useTool()
  const value = asLifePath(result.value)
  return (
    <section
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-7"
    >
      <h2
        id={labelId}
        className="m-0 font-normal font-sans text-ink-subtle text-sm uppercase tracking-[1.5px]"
      >
        {example
          ? m.numerology_result_example({ date: formatLongDate(date) })
          : m.numerology_result_label()}
      </h2>
      <NumberHeadline result={result} />
      <LifePathSteps result={result} date={date} />
      <p className="m-0 text-[15px] text-ink-muted leading-relaxed">{NUMBER_SUMMARY[value]()}</p>
      <a
        href={lifePathPath(value)}
        onClick={() => track('tool_link_click', { target: `life-path-${value}` })}
        className="inline-flex min-h-11 items-center text-base text-brand-ink underline-offset-4 hover:underline"
      >
        {m.numerology_read_meaning({ number: value })}
      </a>
      <p className="m-0 text-ink-subtle text-xs">{m.numerology_result_note()}</p>
      {footer}
    </section>
  )
}

/** 1–33 数字网格（原型「All life path numbers」）：当前数字用星金描边 */
export function NumberGrid({ current, title }: { current?: number | undefined; title?: string }) {
  const headingId = useId()
  const { track } = useTool()
  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-3.5">
      <h2
        id={headingId}
        className="m-0 font-heading font-semibold text-[28px] text-ink sm:text-[32px]"
      >
        {title ?? m.numerology_grid_title()}
      </h2>
      <ul className="m-0 grid list-none grid-cols-4 gap-2.5 p-0 sm:grid-cols-6 lg:grid-cols-12">
        {LIFE_PATH_NUMBERS.map((value) => (
          <li key={value}>
            <a
              href={lifePathPath(value)}
              aria-label={m.numerology_grid_link({ number: value })}
              aria-current={value === current ? 'page' : undefined}
              onClick={() => track('tool_link_click', { target: `life-path-${value}` })}
              className="flex min-h-16 items-center justify-center rounded-xl border border-line bg-surface-2 font-heading text-[28px] text-ink transition-colors hover:border-line-strong aria-[current=page]:border-brand aria-[current=page]:text-brand"
            >
              {value}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** 表单下方的字段错误（aria-live 播报） */
export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <p id={id} aria-live="polite" className="m-0 text-destructive text-sm empty:hidden">
      {children}
    </p>
  )
}

/** MDX 正文（构建期渲染的 HTML），标题用西方站衬线字体，段落宽度对齐原型的 720px */
export function NumerologyArticle({ html }: { html: string }) {
  return (
    <article className="max-w-[720px] text-[17px] text-ink-muted">
      <RichContent
        html={html}
        className="leading-[1.75] [&_a]:text-brand-ink [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-heading [&_h2]:font-semibold [&_h2]:text-[28px] [&_h2]:text-ink [&_h2]:leading-tight [&_h2:first-child]:mt-0 sm:[&_h2]:text-[34px] [&_pre]:bg-surface-2 [&_pre]:text-[15px] [&_pre]:text-ink [&_code]:bg-surface-2"
      />
    </article>
  )
}
