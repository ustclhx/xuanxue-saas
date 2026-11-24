import type { BirthDate, NumberResult } from '@xuanxue/numerology'
import { cn } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { m } from '../../../paraglide/messages.js'
import { RichContent } from '../../marketing/rich-content.tsx'
import { LifePathChart } from '../charts/life-path-chart.tsx'
import { useTool } from '../context.tsx'
import { formatLongDate, lifePathLines } from './calc.ts'
import { asLifePath, NUMBER_SUMMARY } from './copy.ts'
import { lifePathHref, numerologyLocale } from './href.ts'
import { LIFE_PATH_NUMBERS } from './routes.ts'

/**
 * 大号数字（design.md D14：命盘内的大字用 display，小盘用 title；标题字体、文字色）
 */
export function BigNumber({ value, size }: { value: number; size?: 'sm' | undefined }) {
  return (
    <span
      className={cn(
        'font-bold font-heading text-ink',
        size === 'sm' ? 'text-title' : 'text-display',
      )}
    >
      {value}
    </span>
  )
}

export function MasterPill() {
  return (
    <span className="inline-flex min-h-8 items-center rounded-field bg-surface-2 px-3 text-caption text-ink">
      {m.numerology_master()}
    </span>
  )
}

/** 数字 + 大师数胶囊 */
export function NumberHeadline({ result, size }: { result: NumberResult; size?: 'sm' }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <BigNumber value={result.value} size={size} />
      {result.master && <MasterPill />}
    </div>
  )
}

/** 算式行：细线分隔的列表，等宽数字，长算式在窄屏上折行而不是撑出横向滚动 */
export function StepLines({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-line wrap-anywhere text-body text-ink tabular-nums *:py-2.5">
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
          <div key={line.phase} className="font-medium">
            {line.text.replace(/\d+$/, '')}
            <strong>{result.value}</strong>
          </div>
        ) : (
          <div key={line.phase}>
            <span className="text-ink-subtle">{label[line.phase]}</span> {line.input} → {line.text}
            {line.kept && ` ${m.numerology_step_kept()}`}
          </div>
        ),
      )}
    </StepLines>
  )
}

/** 结果卡里的数字环（设计稿 warm-refresh/ToolLifePath.dc.html 的 numring）：两道插画线同心环，数字用 display */
function NumberRing({ value }: { value: number }) {
  return (
    <span className="relative flex size-33 shrink-0 items-center justify-center rounded-full border border-illus">
      <span aria-hidden="true" className="absolute inset-3 rounded-full border border-illus/55" />
      <BigNumber value={value} />
    </span>
  )
}

/**
 * Life Path 结果卡（设计稿 warm-refresh/ToolLifePath.dc.html）：说明标签、数字环、数字标题与摘要、数字页链接，
 * 之后是计算步骤（推导图形加算式）与短声明。`example` 时标签改为样例说明（未提交前展示样例日期的计算过程）。
 * 数字页的样例传入 `note`（openspec content-growth-phase1 决策 4）：摘要换成逐数字撰写的样例说明，并去掉与
 * 结果区底部 `<Disclaimer />` 重复的卡内短声明；访客提交后的结果卡不传 `note`，保持原样。
 */
export function LifePathCard({
  result,
  date,
  example,
  note,
  current,
  footer,
}: {
  result: NumberResult
  date: BirthDate
  example?: boolean
  /** 样例说明（只在 `example` 时生效） */
  note?: string | undefined
  /** 所在数字页的数字：结果与它相同时不输出数字页链接（否则是指向本页的链接） */
  current?: number | undefined
  footer?: ReactNode
}) {
  const labelId = useId()
  const { track } = useTool()
  const value = asLifePath(result.value)
  const exampleNote = example ? note : undefined
  return (
    <section
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-4 rounded-object bg-surface p-6 sm:p-8"
    >
      <p className="m-0 text-caption text-ink-subtle">
        {example
          ? m.numerology_result_example({ date: formatLongDate(date, numerologyLocale()) })
          : m.numerology_result_label()}
      </p>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
        <NumberRing value={result.value} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id={labelId} className="m-0 font-heading text-ink text-subtitle">
              {m.numerology_grid_link({ number: value })}
            </h2>
            {result.master && <MasterPill />}
          </div>
          <p className="m-0 text-body text-ink-muted">{exampleNote ?? NUMBER_SUMMARY[value]()}</p>
          {value !== current && (
            <a
              href={lifePathHref(value)}
              onClick={() => track('tool_link_click', { target: `life-path-${value}` })}
              className="inline-flex min-h-11 items-center text-body text-brand-ink hover:decoration-2"
            >
              {m.numerology_number_link({ number: value })}
              <span aria-hidden="true">&nbsp;→</span>
            </a>
          )}
        </div>
      </div>
      {/* 打印时「计算步骤」标题、推导图与算式同页，续页不从无标题的算式开始 */}
      <div className="flex flex-col gap-4 print:break-inside-avoid">
        <h3 className="m-0 mt-2 font-heading text-ink text-subtitle">
          {m.numerology_steps_label()}
        </h3>
        <LifePathChart result={result} date={date} />
        <LifePathSteps result={result} date={date} />
      </div>
      {!exampleNote && (
        <p role="note" className="m-0 text-caption text-ink-subtle">
          {m.numerology_result_note()}
        </p>
      )}
      {footer}
    </section>
  )
}

/**
 * 1–33 数字网格（设计稿「All life path numbers」）：surface 方块，当前数字用站点强调色描边。
 * 模板区块（data-link-zone="related"）：锚文本只是数字本身，不计正文锚文本表述
 * （content-growth-v2-tools 第 26 组：angel number 页正文链接到数字页时用两种文字锚文本）。
 */
export function NumberGrid({ current, title }: { current?: number | undefined; title?: string }) {
  const headingId = useId()
  const { track } = useTool()
  return (
    <nav aria-labelledby={headingId} data-link-zone="related" className="flex flex-col gap-4">
      <h2 id={headingId} className="m-0 font-heading text-ink text-subtitle">
        {title ?? m.numerology_grid_title()}
      </h2>
      <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-6">
        {LIFE_PATH_NUMBERS.map((value) => (
          <li key={value}>
            <a
              href={lifePathHref(value)}
              aria-label={m.numerology_number_link({ number: value })}
              aria-current={value === current ? 'page' : undefined}
              onClick={() => track('tool_link_click', { target: `life-path-${value}` })}
              className="flex min-h-14 items-center justify-center rounded-field bg-surface font-bold font-heading text-ink text-subtitle no-underline transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-[current=page]:ring-1 aria-[current=page]:ring-mark aria-[current=page]:ring-inset"
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
    <p id={id} aria-live="polite" className="m-0 text-caption text-danger empty:hidden">
      {children}
    </p>
  )
}

/** MDX 正文（构建期渲染的 HTML）：限宽 720px，正文用 body，小标题用 title（工具页长文在结果之后） */
export function NumerologyArticle({ html }: { html: string }) {
  return (
    <article className="max-w-180 text-ink-muted">
      <RichContent
        html={html}
        className="[&_a]:text-brand-ink [&_code]:bg-surface-2 [&_code]:text-caption [&_h2:first-child]:mt-0 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-balance [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-title [&_h3]:font-heading [&_h3]:text-ink [&_h3]:text-subtitle [&_li]:text-body [&_p]:text-body [&_pre]:bg-surface-2 [&_pre]:text-ink [&_pre_code]:text-body [&_table]:text-caption"
      />
    </article>
  )
}
