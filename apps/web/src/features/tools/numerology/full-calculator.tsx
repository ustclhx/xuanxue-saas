import { type BirthDate, numerologyChart } from '@xuanxue/numerology'
import { useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { numerologyUnlock } from '../../readings/unlock-requests.ts'
import { useTool } from '../context.tsx'
import { SubmitButton, TextField, ToolForm } from '../form.tsx'
import { ReadingSlots } from '../reading-slots.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ShareLink } from '../share-link.tsx'
import { formatBirthDate, parseBirthDate, reductionText } from './calc.ts'
import { BirthDateField } from './life-path-calculator.tsx'
import { NAME_NUMBER_COPY, NameNumberBlock, type NameNumberKey } from './name-calculator.tsx'
import { FieldError, LifePathSteps, NumberHeadline, StepLines } from './parts.tsx'
import { lifePathPath } from './routes.ts'
import { useSharedInput } from './use-shared-input.ts'

type Chart = ReturnType<typeof numerologyChart>

/** 计算失败（日期不存在）时返回 null；姓名错误由引擎放在 nameError，日期类数字照常输出 */
export function calculateChart(date: BirthDate | null, localYear: number, name?: string) {
  if (!date) return null
  try {
    return numerologyChart(date, localYear, name)
  } catch {
    return null
  }
}

/**
 * 完整计算器（specs/numerology-pages「完整计算器」）：姓名可留空，留空时姓名类数字显示
 * 「Add your name to unlock」。个人年使用访客设备上的当前公历年。分享链接只含日期。
 */
export function FullCalculator() {
  const { track } = useTool()
  const dateErrorId = useId()
  const nameErrorId = useId()
  const [state, setState] = useState<{ date: BirthDate; year: number; chart: Chart } | null>(null)
  const [invalidDate, setInvalidDate] = useState(false)

  const show = (dateValue: unknown, name?: string) => {
    const date = parseBirthDate(dateValue)
    const year = new Date().getFullYear()
    const chart = calculateChart(date, year, name)
    setInvalidDate(!chart)
    if (!date || !chart) return
    setState({ date, year, chart })
    track('result_view')
  }
  useSharedInput((shared) => shared.date && show(shared.date))

  const chart = state?.chart
  const nameError = chart?.nameError
  return (
    <div className="flex flex-col gap-5">
      <ToolForm
        label={m.numerology_calc_form_label()}
        onSubmit={(data) => show(data.get('birthDate'), String(data.get('name') ?? ''))}
      >
        <TextField
          label={m.numerology_name_label()}
          name="name"
          autoComplete="name"
          maxLength={120}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameErrorId}
        />
        <BirthDateField errorId={dateErrorId} invalid={invalidDate} />
        <SubmitButton>{m.numerology_calculate()}</SubmitButton>
      </ToolForm>
      <FieldError id={nameErrorId}>{nameError && m.numerology_name_invalid()}</FieldError>
      <FieldError id={dateErrorId}>{invalidDate && m.numerology_date_invalid()}</FieldError>
      {state && chart && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <ResultBlock
              id="life-path"
              title={m.numerology_number_life_path()}
              description={m.numerology_desc_life_path()}
            >
              <NumberHeadline result={chart.lifePath} size="sm" />
              <LifePathSteps result={chart.lifePath} date={state.date} />
              <a
                href={lifePathPath(chart.lifePath.value)}
                className="inline-flex min-h-11 items-center text-brand-ink underline-offset-4 hover:underline"
              >
                {m.numerology_read_meaning({ number: chart.lifePath.value })}
              </a>
            </ResultBlock>
            {(['expression', 'soulUrge', 'personality'] as NameNumberKey[]).map((key) =>
              chart.name ? (
                <NameNumberBlock key={key} which={key} result={chart.name[key]} />
              ) : (
                <ResultBlock
                  key={key}
                  id={NAME_NUMBER_COPY[key].id}
                  title={NAME_NUMBER_COPY[key].title()}
                  description={NAME_NUMBER_COPY[key].description()}
                >
                  <p className="m-0 flex min-h-16 items-center rounded-lg border border-line-strong border-dashed px-4 text-ink-muted">
                    {m.numerology_name_unlock()}
                  </p>
                </ResultBlock>
              ),
            )}
            <ResultBlock
              id="birthday"
              title={m.numerology_number_birthday()}
              description={m.numerology_desc_birthday()}
            >
              <NumberHeadline result={chart.birthday} size="sm" />
              <StepLines>
                <div>
                  {m.numerology_step_day()} {state.date.day}
                  {chart.birthday.steps.length > 0 && ` → ${reductionText(chart.birthday)}`}
                  {chart.birthday.master && ` ${m.numerology_step_kept()}`}
                </div>
              </StepLines>
            </ResultBlock>
            <ResultBlock
              id="personal-year"
              title={m.numerology_number_personal_year({ year: state.year })}
              description={m.numerology_desc_personal_year()}
            >
              <NumberHeadline result={chart.personalYear} size="sm" />
              <LifePathSteps
                result={chart.personalYear}
                date={{ ...state.date, year: state.year }}
              />
            </ResultBlock>
          </div>
          <ShareLink input={{ date: formatBirthDate(state.date) }} />
          <ReadingSlots
            tool="numerology-calculator"
            optin={{
              result: { kind: 'numerology', lifePath: chart.lifePath.value },
              share: { date: formatBirthDate(state.date) },
            }}
          >
            <ReadingUnlock
              kind="numerology-full"
              request={numerologyUnlock(
                state.date,
                formatBirthDate(state.date),
                chart.name?.normalized,
              )}
            />
          </ReadingSlots>
        </div>
      )}
    </div>
  )
}
