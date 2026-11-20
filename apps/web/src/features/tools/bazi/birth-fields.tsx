import type { InputField, InputIssue } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { useId } from 'react'
import { m } from '../../../paraglide/messages.js'
import type { EastLocale } from '../../i18n/locales.ts'
import { DatePart, TimeField } from '../date-field.tsx'
import {
  CheckboxField,
  ChoiceGroup,
  FieldError,
  fieldLabel,
  SelectField,
  TextField,
} from '../form.tsx'
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
  advancedCollapsed = false,
}: {
  /** 当前值：决定默认值与条件字段（闰月、手选时区） */
  values: BirthFormValues
  locale: EastLocale
  prefix?: string
  issues?: readonly InputIssue[]
  /** 韩语页：진태양시 开关默认开启，展开进阶选项后用醒目提示说明可关闭（决策 D5） */
  trueSolarCallout?: boolean
  /** 双人表单（궁합）：进阶选项始终先收起，只有真太阳时有错误时展开 */
  advancedCollapsed?: boolean
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
  const otherPlace = values.place === OTHER_PLACE
  return (
    <>
      {/* 出生日期：标签行右侧是曆法切换（设计稿 ToolBazi：手机首屏只留日期、时间、性别、出生地与提交） */}
      <fieldset
        className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
        aria-describedby={dateIssue ? dateErrorId : undefined}
      >
        <legend className="sr-only">{m.bazi_birth_date()}</legend>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span aria-hidden="true" className={fieldLabel}>
            {m.bazi_birth_date()}
          </span>
          <ChoiceGroup
            compact
            legend={m.bazi_calendar()}
            name={name('calendar')}
            defaultValue={values.calendar}
            options={[
              { value: 'solar', label: m.bazi_calendar_solar() },
              { value: 'lunar', label: m.bazi_calendar_lunar() },
            ]}
          />
        </div>
        <div className="grid grid-cols-7 gap-2">
          <DatePart
            label={m.bazi_year()}
            name={name('year')}
            defaultValue={values.year}
            placeholder="1990"
            maxLength={4}
            invalid={Boolean(byField.year)}
            className="col-span-3"
          />
          <DatePart
            label={m.bazi_month()}
            name={name('month')}
            defaultValue={values.month}
            placeholder="5"
            maxLength={2}
            invalid={Boolean(byField.month)}
            className="col-span-2"
          />
          <DatePart
            label={m.bazi_day()}
            name={name('day')}
            defaultValue={values.day}
            placeholder="15"
            maxLength={2}
            invalid={Boolean(byField.day)}
            className="col-span-2"
          />
        </div>
        {lunar && (
          <CheckboxField
            label={m.bazi_leap_month()}
            name={name('leap')}
            defaultChecked={values.leap}
          />
        )}
        <FieldError
          id={dateErrorId}
          alert
          error={dateIssue ? issueMessage(dateIssue) : undefined}
        />
        <FieldError
          alert
          error={lunar && byField.leapMonth ? issueMessage(byField.leapMonth) : undefined}
        />
      </fieldset>
      {/* 出生时间：时 / 分分段（按页面语言显示），标签行右侧是「不知道出生时辰」 */}
      <TimeField
        label={m.bazi_time()}
        name={name('time')}
        defaultValue={values.time}
        disabled={values.unknownTime}
        error={values.unknownTime ? undefined : error('time')}
        aside={
          <CheckboxField
            label={m.bazi_unknown_time()}
            name={name('unknownTime')}
            defaultChecked={values.unknownTime}
          />
        }
      />
      <ChoiceGroup
        legend={m.bazi_gender()}
        name={name('gender')}
        defaultValue={values.gender}
        options={[
          { value: 'male', label: m.bazi_gender_male() },
          { value: 'female', label: m.bazi_gender_female() },
        ]}
      />
      <SelectField
        label={m.bazi_place()}
        name={name('place')}
        defaultValue={values.place}
        error={otherPlace ? undefined : error('location')}
        options={[
          ...PLACE_IDS[locale].map((id) => ({ value: id, label: CITY_LABEL[id]() })),
          { value: OTHER_PLACE, label: m.bazi_place_other() },
        ]}
      />
      {/* 手选地点时必须填写时区，直接显示在出生地之后，不收进进阶选项 */}
      {otherPlace && (
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
      {/*
        进阶选项默认收起（tool-pages「工具页紧凑布局」：手机首屏可见提交按钮），韩语页同样收起；收起时字段仍在表单里，照常提交。
        真太阳时的取值与本页默认值不同（中文页已勾选、韩语页已关闭：分享恢复、跨页带入或访客改过）或真太阳时有错误时展开，
        让访客看得到非默认的设置。韩语页默认开启진태양시（决策 D5），是否校正与校正分钟数写在结果的排盘时间里。
      */}
      <details
        className="group order-last col-span-full"
        open={
          (!advancedCollapsed && values.trueSolar !== trueSolarCallout) ||
          Boolean(byField.trueSolarTime) ||
          undefined
        }
      >
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-brand-ink text-caption underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
          {m.bazi_advanced_options()}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-open:rotate-180"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </summary>
        <div
          className={cn(
            'flex min-w-0 flex-col',
            trueSolarCallout && 'rounded-field bg-surface-2 px-3 py-2',
          )}
        >
          <CheckboxField
            label={m.bazi_true_solar()}
            name={name('trueSolar')}
            defaultChecked={values.trueSolar}
            aria-describedby={hintId}
            className="text-body text-ink"
          />
          <p id={hintId} className="m-0 text-caption text-ink-subtle">
            {m.bazi_true_solar_hint()}
          </p>
        </div>
      </details>
    </>
  )
}
