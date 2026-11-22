import { type BirthDate, lifePath, type NumberResult } from '@xuanxue/numerology'
import { useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { numerologyUnlock } from '../../readings/unlock-requests.ts'
import { useTool } from '../context.tsx'
import { DateField } from '../date-field.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ReadingSlots } from '../reading-slots.tsx'
import { lifePathShareCard } from '../share-card/sources-life-path.ts'
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

/**
 * 出生日期输入：年 / 月 / 日分段，提交 YYYY-MM-DD。
 * 不用原生日期控件：其占位符随浏览器界面语言显示（中文浏览器在英文站显示「年/月/日」）。
 */
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
    <DateField
      label={label}
      name={name}
      required
      defaultValue={defaultValue}
      invalid={invalid}
      describedBy={errorId}
      className={className}
    />
  )
}

/**
 * Life Path 计算器（工具页 `/life-path-number` 与 12 个数字页内嵌共用；设计稿 warm-refresh/ToolLifePath.dc.html）：
 * 表单面板只含出生日期与提交按钮，结果卡紧随其后；未提交前显示样例日期的算式。
 * 结果在浏览器本地计算，分享链接只含日期（`#r=`）。须放在 ToolContext 内（埋点）。
 */
export function LifePathCalculator({
  example = EXAMPLE,
  unlock = false,
  current,
  note,
}: {
  example?: BirthDate
  /** 数字页逐数字撰写的样例说明：只在未提交时的样例卡显示；`/life-path-number` 工具页不传 */
  note?: string | undefined
  /** 内嵌在某个数字页时为该页的数字：结果正好是它时不再链接到本页 */
  current?: number
  /** 显示完整分析解锁卡（只在工具页，数字页内嵌时不显示） */
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
    <div className="flex flex-col gap-8 sm:gap-10">
      <ToolForm label={m.numerology_form_label()} onSubmit={(data) => show(data.get('birthDate'))}>
        <ProfileBar
          target={{ kind: 'numerology', date: true, name: false }}
          className="col-span-full"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <BirthDateField errorId={errorId} invalid={invalid} />
          <FieldError id={errorId}>{invalid && m.numerology_date_invalid()}</FieldError>
        </div>
        {/* 桌面与日期并排、对齐输入框底边；手机占满一行 */}
        <SubmitButton className="sm:col-span-1 sm:self-end">
          {m.numerology_calculate()}
        </SubmitButton>
      </ToolForm>
      <div id="life-path-result" aria-live="polite" className="min-w-0 scroll-mt-6">
        {calculated ? (
          <LifePathCard
            result={calculated.result}
            date={calculated.date}
            current={current}
            footer={
              <ShareLink
                input={{ date: formatBirthDate(calculated.date) }}
                card={() => lifePathShareCard(calculated.result, calculated.date)}
              />
            }
          />
        ) : (
          <LifePathCard
            result={lifePath(example)}
            date={example}
            current={current}
            note={note}
            example
          />
        )}
      </div>
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
