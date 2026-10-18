import { type BirthDate, lifePath, type NumberResult, nameNumbers } from '@xuanxue/numerology'
import { useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { useTool } from '../context.tsx'
import { SubmitButton, TextField, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ShareLink } from '../share-link.tsx'
import {
  birthDigits,
  CHART_LAYOUT,
  chartSummary,
  digitCounts,
  formatBirthDate,
  nameLetters,
  parseBirthDate,
} from './calc.ts'
import { BirthDateField } from './life-path-calculator.tsx'
import { FieldError, LifePathSteps, NumberHeadline } from './parts.tsx'
import { useSharedInput } from './use-shared-input.ts'

/** 3×3 数字分布图：每格重复显示该数字（如 `11`），空格标出缺失；读屏读「Digit 1: 2 times」 */
export function DigitGrid({
  counts,
  caption,
}: {
  counts: Record<number, number>
  caption: string
}) {
  return (
    <table className="w-full max-w-[360px] table-fixed border-separate border-spacing-2">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {CHART_LAYOUT.map((row) => (
          <tr key={row.join()}>
            {row.map((digit) => {
              const count = counts[digit] ?? 0
              return (
                <td
                  key={digit}
                  aria-label={m.numerology_chart_digit({ digit, count })}
                  className="p-0"
                >
                  <div
                    className={
                      count
                        ? 'flex aspect-square flex-col items-center justify-center rounded-xl border border-line-strong bg-surface-2 p-1'
                        : 'flex aspect-square flex-col items-center justify-center rounded-xl border border-line border-dashed p-1'
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        count
                          ? 'break-all text-center font-heading text-[28px] text-brand leading-none'
                          : 'font-heading text-[28px] text-ink-subtle/50 leading-none'
                      }
                    >
                      {count ? String(digit).repeat(Math.min(count, 6)) : digit}
                    </span>
                    <span aria-hidden="true" className="mt-1 text-ink-subtle text-xs tabular-nums">
                      ×{count}
                    </span>
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChartFacts({ counts }: { counts: Record<number, number> }) {
  const { missing, repeated } = chartSummary(counts)
  return (
    <dl className="m-0 grid gap-2 text-[15px]">
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-ink-subtle">{m.numerology_chart_missing()}:</dt>
        <dd className="m-0 text-ink">
          {missing.length ? missing.join(', ') : m.numerology_chart_missing_none()}
        </dd>
      </div>
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-ink-subtle">{m.numerology_chart_repeated()}:</dt>
        <dd className="m-0 text-ink">
          {repeated.length ? repeated.join(', ') : m.numerology_chart_repeated_none()}
        </dd>
      </div>
    </dl>
  )
}

interface ChartState {
  readonly date: BirthDate
  readonly lifePath: NumberResult
  readonly birth: Record<number, number>
  readonly name: Record<number, number> | null
}

/**
 * 数字分布图（/numerology-chart）：出生日期各位数字在九宫中的分布，附生命灵数；
 * 填写姓名时再给出字母取值的分布。分享链接只含日期。
 */
export function ChartCalculator() {
  const { track } = useTool()
  const dateErrorId = useId()
  const nameErrorId = useId()
  const [state, setState] = useState<ChartState | null>(null)
  const [invalidDate, setInvalidDate] = useState(false)
  const [invalidName, setInvalidName] = useState(false)

  const show = (dateValue: unknown, name = '') => {
    const date = parseBirthDate(dateValue)
    let result: NumberResult | null = null
    try {
      result = date && lifePath(date)
    } catch {
      result = null
    }
    setInvalidDate(!result)
    if (!date || !result) return
    let nameCounts: Record<number, number> | null = null
    setInvalidName(false)
    if (name.trim()) {
      try {
        const letters = nameLetters(nameNumbers(name).normalized).flat()
        nameCounts = digitCounts(letters.map((letter) => letter.value))
      } catch {
        setInvalidName(true)
      }
    }
    setState({ date, lifePath: result, birth: digitCounts(birthDigits(date)), name: nameCounts })
    track('result_view')
  }
  useSharedInput((shared) => shared.date && show(shared.date))

  return (
    <div className="flex flex-col gap-5">
      <ToolForm
        label={m.numerology_chart_form_label()}
        onSubmit={(data) => show(data.get('birthDate'), String(data.get('name') ?? ''))}
      >
        <BirthDateField errorId={dateErrorId} invalid={invalidDate} />
        <TextField
          label={m.numerology_name_label()}
          name="name"
          autoComplete="name"
          maxLength={120}
          aria-invalid={invalidName || undefined}
          aria-describedby={nameErrorId}
        />
        <SubmitButton>{m.numerology_calculate()}</SubmitButton>
      </ToolForm>
      <FieldError id={dateErrorId}>{invalidDate && m.numerology_date_invalid()}</FieldError>
      <FieldError id={nameErrorId}>{invalidName && m.numerology_name_invalid()}</FieldError>
      {state && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <ResultBlock
              id="birth-grid"
              title={m.numerology_chart_birth_grid()}
              aside={formatBirthDate(state.date)}
              description={m.numerology_chart_birth_desc()}
            >
              <DigitGrid counts={state.birth} caption={m.numerology_chart_birth_grid()} />
              <ChartFacts counts={state.birth} />
            </ResultBlock>
            <ResultBlock
              id="life-path"
              title={m.numerology_number_life_path()}
              description={m.numerology_desc_life_path()}
            >
              <NumberHeadline result={state.lifePath} size="sm" />
              <LifePathSteps result={state.lifePath} date={state.date} />
            </ResultBlock>
            {state.name && (
              <ResultBlock
                id="name-grid"
                title={m.numerology_chart_name_grid()}
                description={m.numerology_chart_name_desc()}
              >
                <DigitGrid counts={state.name} caption={m.numerology_chart_name_grid()} />
                <ChartFacts counts={state.name} />
              </ResultBlock>
            )}
          </div>
          <ShareLink input={{ date: formatBirthDate(state.date) }} />
        </div>
      )}
    </div>
  )
}
