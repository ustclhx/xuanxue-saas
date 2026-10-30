import {
  type BirthDate,
  COMPATIBILITY_MATRIX,
  compatibility,
  LIFE_PATH_VALUES,
} from '@xuanxue/numerology'
import { cn } from '@xuanxue/ui'
import { useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { useTool } from '../context.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ShareLink } from '../share-link.tsx'
import { formatBirthDate, parseBirthDate } from './calc.ts'
import {
  asLifePath,
  type CompatibilityLevel,
  LEVEL_EXPLAIN,
  LEVEL_LABEL,
  NUMBER_THEME,
} from './copy.ts'
import { BirthDateField } from './life-path-calculator.tsx'
import { FieldError, LifePathSteps, NumberHeadline } from './parts.tsx'
import { NumerologyReadingGuide } from './reading-guide.tsx'
import { lifePathPath } from './routes.ts'
import { useSharedInput } from './use-shared-input.ts'

type Result = ReturnType<typeof compatibility>

/** 等级用文字 + 图形区分（不只靠颜色）：high 实心星金、medium 描边、challenging 虚线 */
const levelStyle: Record<CompatibilityLevel, string> = {
  high: 'border-brand bg-brand text-on-brand',
  medium: 'border-brand text-brand',
  challenging: 'border-line-strong border-dashed text-ink-muted',
}

export function LevelBadge({
  level,
  className,
}: {
  level: CompatibilityLevel
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center rounded-full border px-3 font-semibold text-sm',
        levelStyle[level],
        className,
      )}
    >
      {LEVEL_LABEL[level]()}
    </span>
  )
}

/** 某个生命灵数与全部 12 个数字的等级（相性表的一行） */
export function CompatibilityRow({ value }: { value: number }) {
  const row = COMPATIBILITY_MATRIX[LIFE_PATH_VALUES.indexOf(asLifePath(value))] ?? []
  return (
    <ResultBlock id="row" title={m.numerology_compat_row({ number: value })}>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {LIFE_PATH_VALUES.map((other, index) => {
          const level = row[index] ?? 'medium'
          return (
            <li key={other}>
              <a
                href={lifePathPath(other)}
                aria-label={m.numerology_compat_cell({
                  number: other,
                  level: LEVEL_LABEL[level](),
                })}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 transition-colors hover:border-line-strong"
              >
                <span className="font-heading text-ink text-xl">{other}</span>
                <LevelBadge level={level} className="min-h-7 px-2.5 text-xs" />
              </a>
            </li>
          )
        })}
      </ul>
    </ResultBlock>
  )
}

/**
 * 生命灵数相性（/life-path-compatibility，specs/numerology「相性」）：两个生日 → 双方生命灵数、
 * 固定相性表等级与说明（按等级 + 双方数字主题组合，说明 key 由引擎给出）。分享链接只含两个日期。
 */
export function CompatibilityCalculator() {
  const { track } = useTool()
  const errorId = useId()
  const [state, setState] = useState<{
    first: BirthDate
    second: BirthDate
    result: Result
  } | null>(null)
  const [invalid, setInvalid] = useState(false)

  const show = (firstValue: unknown, secondValue: unknown) => {
    const first = parseBirthDate(firstValue)
    const second = parseBirthDate(secondValue)
    let result: Result | null = null
    try {
      result = first && second ? compatibility(first, second) : null
    } catch {
      result = null
    }
    setInvalid(!result)
    if (!first || !second || !result) return
    setState({ first, second, result })
    track('result_view')
  }
  useSharedInput((shared) => shared.first && shared.second && show(shared.first, shared.second))

  const result = state?.result
  const left = result && asLifePath(result.left.value)
  const right = result && asLifePath(result.right.value)
  return (
    <div className="flex flex-col gap-5">
      <ToolForm
        label={m.numerology_compat_form_label()}
        onSubmit={(data) => show(data.get('first'), data.get('second'))}
      >
        <BirthDateField
          name="first"
          label={m.numerology_compat_first()}
          errorId={errorId}
          invalid={invalid}
        />
        <BirthDateField
          name="second"
          label={m.numerology_compat_second()}
          errorId={errorId}
          invalid={invalid}
        />
        <SubmitButton>{m.numerology_calculate()}</SubmitButton>
      </ToolForm>
      <FieldError id={errorId}>{invalid && m.numerology_date_invalid()}</FieldError>
      {state && result && left && right && (
        <div className="flex flex-col gap-5">
          <ResultBlock id="compatibility" title={m.numerology_compat_result()}>
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-heading text-[56px] text-brand leading-none">
                {left} &amp; {right}
              </span>
              <LevelBadge level={result.level} className="min-h-10 px-4 text-base" />
            </div>
            <p className="m-0 max-w-[720px] text-ink-muted leading-relaxed">
              {LEVEL_EXPLAIN[result.level]({
                left: String(left),
                right: String(right),
                leftTheme: NUMBER_THEME[left](),
                rightTheme: NUMBER_THEME[right](),
              })}
            </p>
            <p className="m-0 text-ink-subtle text-xs">{m.numerology_compat_note()}</p>
          </ResultBlock>
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ['you', m.numerology_compat_you(), state.first, result.left],
                ['them', m.numerology_compat_them(), state.second, result.right],
              ] as const
            ).map(([id, title, date, value]) => (
              <ResultBlock key={id} id={id} title={title} aside={formatBirthDate(date)}>
                <NumberHeadline result={value} size="sm" />
                <LifePathSteps result={value} date={date} />
                <a
                  href={lifePathPath(value.value)}
                  className="inline-flex min-h-11 items-center text-brand-ink underline-offset-4 hover:underline"
                >
                  {m.numerology_read_meaning({ number: value.value })}
                </a>
              </ResultBlock>
            ))}
          </div>
          <CompatibilityRow value={left} />
          <ShareLink
            input={{ first: formatBirthDate(state.first), second: formatBirthDate(state.second) }}
          />
          <NumerologyReadingGuide />
        </div>
      )}
    </div>
  )
}
