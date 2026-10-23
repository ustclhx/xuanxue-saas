import type { InputField, InputIssue } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { useId } from 'react'
import { m } from '../../../paraglide/messages.js'
import { CheckboxField, ChoiceGroup, SelectField, TextField } from '../form.tsx'
import {
  type BirthFormValues,
  formatUtcOffset,
  issuesByField,
  OTHER_PLACE,
  PLACE_IDS,
  UTC_OFFSETS,
} from './birth-form-state.ts'
import { CITY_LABEL, issueMessage } from './labels.ts'

/**
 * 共用出生信息字段（tasks.md 2.1）：国历⇄农历（含闰月）、性别、年月日、时间、不知道时辰、出生地、真太阳时。
 * 八字、紫微、命盘查询、만세력与궁합共用；字段名加 prefix 后可在同一张表单里放两个人。
 * 控件为非受控（defaultValue），外部恢复输入时由页面更换 key 重新挂载。
 */
export function BirthFields({
  values,
  locale,
  prefix = '',
  issues = [],
  trueSolarCallout = false,
}: {
  /** 当前值：决定默认值与条件字段（闰月、手选时区） */
  values: BirthFormValues
  locale: 'zh-Hant' | 'zh-Hans' | 'ko'
  prefix?: string
  issues?: readonly InputIssue[]
  /** 韩语页：진태양시 开关默认开启，并用醒目提示说明可关闭（决策 D5） */
  trueSolarCallout?: boolean
}) {
  const name = (field: keyof BirthFormValues) => `${prefix}${field}`
  const byField = issuesByField(issues)
  const error = (field: InputField) => {
    const issue = byField[field]
    return issue ? issueMessage(issue) : undefined
  }
  const dateIssue = byField.year ?? byField.month ?? byField.day
  const dateErrorId = useId()
  const hintId = useId()
  const lunar = values.calendar === 'lunar'
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <ChoiceGroup
          legend={m.bazi_calendar()}
          name={name('calendar')}
          defaultValue={values.calendar}
          options={[
            { value: 'solar', label: m.bazi_calendar_solar() },
            { value: 'lunar', label: m.bazi_calendar_lunar() },
          ]}
        />
        {lunar && (
          <div className="flex flex-col">
            <CheckboxField
              label={m.bazi_leap_month()}
              name={name('leap')}
              defaultChecked={values.leap}
            />
            {byField.leapMonth && (
              <span role="alert" className="text-brand-ink text-sm">
                {issueMessage(byField.leapMonth)}
              </span>
            )}
          </div>
        )}
      </div>
      <ChoiceGroup
        legend={m.bazi_gender()}
        name={name('gender')}
        defaultValue={values.gender}
        options={[
          { value: 'male', label: m.bazi_gender_male() },
          { value: 'female', label: m.bazi_gender_female() },
        ]}
      />
      <fieldset
        className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
        aria-describedby={dateIssue ? dateErrorId : undefined}
      >
        <legend className="mb-1.5 p-0 text-ink-muted text-sm">{m.bazi_birth_date()}</legend>
        <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2">
          <DatePart
            label={m.bazi_year()}
            name={name('year')}
            defaultValue={values.year}
            placeholder="1990"
            maxLength={4}
            invalid={Boolean(byField.year)}
          />
          <DatePart
            label={m.bazi_month()}
            name={name('month')}
            defaultValue={values.month}
            placeholder="5"
            maxLength={2}
            invalid={Boolean(byField.month)}
          />
          <DatePart
            label={m.bazi_day()}
            name={name('day')}
            defaultValue={values.day}
            placeholder="15"
            maxLength={2}
            invalid={Boolean(byField.day)}
          />
        </div>
        {dateIssue && (
          <span id={dateErrorId} role="alert" className="text-brand-ink text-sm">
            {issueMessage(dateIssue)}
          </span>
        )}
      </fieldset>
      <TextField
        label={m.bazi_time()}
        name={name('time')}
        type="time"
        defaultValue={values.time}
        disabled={values.unknownTime}
        error={values.unknownTime ? undefined : error('time')}
      />
      <CheckboxField
        label={m.bazi_unknown_time()}
        name={name('unknownTime')}
        defaultChecked={values.unknownTime}
        className="self-end"
      />
      <SelectField
        label={m.bazi_place()}
        name={name('place')}
        defaultValue={values.place}
        error={values.place === OTHER_PLACE ? undefined : error('location')}
        options={[
          ...PLACE_IDS[locale].map((id) => ({ value: id, label: CITY_LABEL[id]() })),
          { value: OTHER_PLACE, label: m.bazi_place_other() },
        ]}
      />
      {values.place === OTHER_PLACE && (
        <>
          <SelectField
            label={m.bazi_utc_offset()}
            name={name('utcOffset')}
            defaultValue={values.utcOffset}
            error={error('location')}
            options={UTC_OFFSETS.map((offset) => ({
              value: String(offset),
              label: formatUtcOffset(offset),
            }))}
          />
          <TextField
            label={m.bazi_longitude()}
            name={name('longitude')}
            inputMode="decimal"
            placeholder="121.56"
            defaultValue={values.longitude}
            error={error('trueSolarTime')}
          />
        </>
      )}
      <div
        className={cn(
          'flex min-w-0 flex-col justify-end',
          trueSolarCallout &&
            'gap-1 rounded-lg border border-brand border-l-4 bg-surface-2 px-3 py-2',
        )}
      >
        <CheckboxField
          label={m.bazi_true_solar()}
          name={name('trueSolar')}
          defaultChecked={values.trueSolar}
          aria-describedby={hintId}
        />
        <p
          id={hintId}
          className={cn(
            'm-0 text-xs leading-relaxed',
            trueSolarCallout ? 'text-ink-muted' : 'text-ink-subtle',
          )}
        >
          {m.bazi_true_solar_hint()}
        </p>
      </div>
    </>
  )
}

function DatePart({
  label,
  invalid,
  ...props
}: { label: string; invalid: boolean } & Omit<React.ComponentProps<'input'>, 'className'>) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-ink-subtle text-xs">
      {label}
      <input
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className="min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 aria-invalid:border-brand"
        {...props}
      />
    </label>
  )
}
