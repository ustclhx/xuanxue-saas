import { type BirthDate, lifePath, type NumberResult } from '@xuanxue/numerology'
import { type ReactNode, useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { numerologyUnlock } from '../../readings/unlock-requests.ts'
import { useTool } from '../context.tsx'
import { SubmitButton, TextField, ToolForm } from '../form.tsx'
import { ReadingSlots } from '../reading-slots.tsx'
import { ShareLink } from '../share-link.tsx'
import { formatBirthDate, parseBirthDate } from './calc.ts'
import { FieldError, LifePathCard } from './parts.tsx'
import { useSharedInput } from './use-shared-input.ts'

// 首屏未提交前展示的样例（specs/numerology「大师数」场景）；数字页改用该数字的样例日期
const EXAMPLE: BirthDate = { year: 1987, month: 11, day: 29 }

interface Calculated {
  readonly date: BirthDate
  readonly result: NumberResult
}

/** 日期 → 生命灵数；日期不存在（如 2 月 30 日）时返回 null */
export function calculateLifePath(value: unknown): Calculated | null {
  const date = parseBirthDate(value)
  if (!date) return null
  try {
    return { date, result: lifePath(date) }
  } catch {
    return null
  }
}

/** 出生日期输入：原生日期控件，移动端调起系统日期选择器 */
export function BirthDateField({
  name = 'birthDate',
  label = m.numerology_date_label(),
  defaultValue,
  errorId,
  invalid,
  className,
}: {
  name?: string
  label?: string
  defaultValue?: string
  errorId?: string
  invalid?: boolean
  className?: string
}) {
  return (
    <TextField
      label={label}
      name={name}
      type="date"
      required
      min="0001-01-01"
      max="9999-12-31"
      defaultValue={defaultValue}
      aria-invalid={invalid || undefined}
      aria-describedby={errorId}
      className={className}
    />
  )
}

/**
 * Life Path 计算器（首页首屏与数字页内嵌共用，原型 LifePath.dc.html）：
 * 左栏标题、导语与只含出生日期的表单，右栏结果卡；未提交前显示 1987-11-29 的样例算式。
 * 结果在浏览器本地计算，分享链接只含日期（`#r=`）。须放在 ToolContext 内（埋点）。
 */
export function LifePathCalculator({
  heading,
  intro,
  example = EXAMPLE,
  unlock = false,
}: {
  heading?: ReactNode
  intro?: ReactNode
  example?: BirthDate
  /** 显示完整分析解锁卡（只在首页，数字页内嵌时不显示） */
  unlock?: boolean
}) {
  const { track } = useTool()
  const errorId = useId()
  const [calculated, setCalculated] = useState<Calculated | null>(null)
  const [invalid, setInvalid] = useState(false)

  const show = (value: unknown) => {
    const next = calculateLifePath(value)
    setInvalid(!next)
    if (!next) return
    setCalculated(next)
    track('result_view')
  }
  useSharedInput((shared) => shared.date && show(shared.date))

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-start gap-8 sm:gap-10">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          {heading}
          {intro && (
            <p className="m-0 max-w-[520px] text-[17px] text-ink-muted leading-relaxed sm:text-lg">
              {intro}
            </p>
          )}
          <ToolForm
            label={m.numerology_form_label()}
            onSubmit={(data) => show(data.get('birthDate'))}
            className="mt-2 flex flex-wrap items-end gap-3 border-0 bg-transparent p-0 sm:p-0"
          >
            <BirthDateField
              className="min-w-0 flex-[1_1_220px]"
              errorId={errorId}
              invalid={invalid}
            />
            <SubmitButton className="flex-[0_0_auto] max-[400px]:w-full">
              {m.numerology_calculate()}
            </SubmitButton>
          </ToolForm>
          <FieldError id={errorId}>{invalid && m.numerology_date_invalid()}</FieldError>
        </div>
        <div
          id="life-path-result"
          aria-live="polite"
          className="min-w-0 flex-[1_1_380px] scroll-mt-6"
        >
          {calculated ? (
            <LifePathCard
              result={calculated.result}
              date={calculated.date}
              footer={<ShareLink input={{ date: formatBirthDate(calculated.date) }} />}
            />
          ) : (
            <LifePathCard result={lifePath(example)} date={example} example />
          )}
        </div>
      </section>
      <ReadingSlots
        tool="life-path"
        optin={
          calculated
            ? {
                result: { kind: 'numerology', lifePath: calculated.result.value },
                share: { date: formatBirthDate(calculated.date) },
              }
            : null
        }
      >
        {unlock && (
          <ReadingUnlock
            kind="numerology-full"
            request={
              calculated
                ? numerologyUnlock(calculated.date, formatBirthDate(calculated.date))
                : null
            }
          />
        )}
      </ReadingSlots>
    </div>
  )
}
