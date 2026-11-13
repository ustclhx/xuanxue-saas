import type { InputIssue, InputIssueCode } from '@xuanxue/bazi'
import type { SiteId } from '@xuanxue/config'
import type { BirthProfileBirth, BirthProfileRelation } from '@xuanxue/db'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@xuanxue/ui'
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { BirthFields } from '../tools/bazi/birth-fields.tsx'
import { readBirthForm, toBirthInput } from '../tools/bazi/birth-form-state.ts'
import { CheckboxField, TextField } from '../tools/form.tsx'
import { BirthDateField } from '../tools/numerology/life-path-calculator.tsx'
import { profileFailureMessage, profileIssueMessage, RELATION_LABEL } from './labels.ts'
import { formValuesOf } from './prefill.ts'
import {
  createBirthProfile,
  type ProfileFailureCode,
  setDefaultBirthProfile,
  updateBirthProfile,
} from './profiles.functions.ts'
import type { BirthProfile, ProfileIssue } from './schema.ts'

/**
 * 出生档案的新建 / 编辑抽屉（原型 ProfileEdit.dc.html）：手机从底部滑出，桌面从右侧滑出。
 * 东方站复用排盘页的 BirthFields（历法、性别、日期、时间、出生地、真太阳时），西方站只有日期与可选全名。
 * 浏览器只检查必填与格式，日期是否存在、闰月等语义规则以服务端（引擎 validateInput）为准，错误按字段显示。
 */

export const RELATIONS: readonly BirthProfileRelation[] = [
  'self',
  'partner',
  'family',
  'friend',
  'other',
]

export type EasternLocale = 'zh-Hant' | 'zh-Hans' | 'ko'

const ENGINE_CODES = new Set<string>([
  'required',
  'out_of_range',
  'invalid_date',
  'leap_month_not_exist',
  'longitude_required',
] satisfies InputIssueCode[])

/** 引擎规则的错误交给 BirthFields 显示；其余（长度、选项）由档案自己的字段显示 */
function birthIssues(issues: readonly ProfileIssue[]): InputIssue[] {
  return issues.filter((issue) => ENGINE_CODES.has(issue.code)) as InputIssue[]
}

/** 宽屏（≥768px）用右侧抽屉，手机用底部抽屉；服务端与首帧按手机渲染（抽屉此时尚未打开） */
function useWide(): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 768px)')
    if (!query) return
    const sync = () => setWide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return wide
}

const pad = (value: number, length: number) => String(value).padStart(length, '0')
const isoDate = (birth: BirthProfileBirth) =>
  birth.calendar === 'solar'
    ? `${pad(birth.year, 4)}-${pad(birth.month, 2)}-${pad(birth.day, 2)}`
    : ''
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

type Failure = { code: ProfileFailureCode | 'UNKNOWN'; issues: ProfileIssue[] }

/** 关系下拉（@xuanxue/ui Select，受控；值由调用方随表单一起提交） */
export function RelationSelect({
  value,
  onChange,
  error,
}: {
  value: BirthProfileRelation
  onChange: (value: BirthProfileRelation) => void
  error?: string | undefined
}) {
  const labelId = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-ink-muted text-sm">
        {m.profiles_field_relation()}
      </span>
      <Select value={value} onValueChange={(next) => onChange(next as BirthProfileRelation)}>
        <SelectTrigger
          aria-labelledby={labelId}
          className="h-11 w-full"
          placeholder={m.profiles_field_relation()}
          valueLabel={RELATION_LABEL[value]()}
          {...(error && { error })}
        />
        <SelectContent>
          {RELATIONS.map((relation, index) => (
            <SelectItem key={relation} index={index} value={relation}>
              {RELATION_LABEL[relation]()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FormAlert({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-xl border border-brand bg-surface px-4 py-3 text-sm"
    >
      {title ? <strong className="text-base text-ink">{title}</strong> : null}
      <p className="m-0 text-ink-muted leading-relaxed">{children}</p>
    </div>
  )
}

export function ProfileEditor({
  open,
  onOpenChange,
  slug,
  site,
  locale,
  profile,
  defaultRelation,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  site: SiteId
  locale: string
  /** 省略时新建 */
  profile?: BirthProfile | undefined
  defaultRelation?: BirthProfileRelation
  onSaved: (profile: BirthProfile) => void
}) {
  const wide = useWide()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        closeLabel={m.profiles_close()}
        className="md:w-full md:max-w-md"
      >
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
          <SheetHeader className="p-0 pr-10">
            <SheetTitle>
              {profile ? m.profiles_editor_edit_title() : m.profiles_editor_new_title()}
            </SheetTitle>
            <SheetDescription className="sr-only">{m.profiles_intro()}</SheetDescription>
          </SheetHeader>
          {open ? (
            <ProfileForm
              key={profile?.id ?? 'new'}
              slug={slug}
              site={site}
              locale={locale}
              profile={profile}
              {...(defaultRelation && { defaultRelation })}
              onSaved={onSaved}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** 抽屉里的表单本体；单独导出便于组件测试（不经过 Sheet 的动画与 Portal） */
export function ProfileForm({
  slug,
  site,
  locale,
  profile,
  defaultRelation = 'self',
  onSaved,
}: {
  slug: string
  site: SiteId
  locale: string
  profile?: BirthProfile | undefined
  /** 新建时的关系：已有「本人」档案时页面传入 other */
  defaultRelation?: BirthProfileRelation
  onSaved: (profile: BirthProfile) => void
}) {
  const east = site === 'east'
  const [values, setValues] = useState(() => formValuesOf(profile, locale))
  const [relation, setRelation] = useState<BirthProfileRelation>(
    profile?.relation ?? defaultRelation,
  )
  const [failure, setFailure] = useState<Failure | null>(null)
  const [dateMissing, setDateMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const issues = failure?.issues ?? []
  const fieldIssue = (field: ProfileIssue['field']) => {
    const issue = issues.find((item) => item.field === field)
    return issue ? profileIssueMessage(issue) : undefined
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (key: string) => {
      const value = data.get(key)
      return typeof value === 'string' ? value.trim() : ''
    }
    let birth: BirthProfileBirth
    if (east) {
      const parsed = toBirthInput(readBirthForm(data))
      if (!parsed.ok) {
        setFailure({ code: 'INVALID_PROFILE', issues: parsed.issues })
        return
      }
      birth = parsed.input
    } else {
      const match = DATE.exec(text('birthDate'))
      setDateMissing(!match)
      if (!match) return
      birth = {
        calendar: 'solar',
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        time: profile?.birth.time ?? null,
        gender: profile?.birth.gender ?? null,
        location: profile?.birth.location ?? null,
      }
    }
    const fields = {
      label: text('label') || null,
      relation,
      birth: birth as unknown as Record<string, unknown>,
      fullName: east ? null : text('fullName') || null,
    }
    const makeDefault = data.has('makeDefault')
    setBusy(true)
    setFailure(null)
    try {
      const result = profile
        ? await updateBirthProfile({ data: { slug, id: profile.id, profile: fields } })
        : await createBirthProfile({ data: { slug, profile: fields, makeDefault } })
      if (!result.ok) {
        setFailure({ code: result.code, issues: result.issues })
        return
      }
      if (profile && makeDefault && !profile.isDefault) {
        // 默认标记单独切换：修改已保存，切换失败只提示，不回滚
        const switched = await setDefaultBirthProfile({ data: { slug, id: profile.id } })
        if (!switched.ok) setFailure({ code: switched.code, issues: [] })
      }
      onSaved(result.value)
    } catch {
      setFailure({ code: 'UNKNOWN', issues: [] })
    } finally {
      setBusy(false)
    }
  }

  const relationError =
    failure?.code === 'PROFILE_SELF_EXISTS' ? m.profiles_self_exists() : fieldIssue('relation')
  const generalError =
    failure && failure.code !== 'INVALID_PROFILE' && failure.code !== 'PROFILE_SELF_EXISTS'
  return (
    <form
      aria-label={profile ? m.profiles_editor_edit_title() : m.profiles_editor_new_title()}
      noValidate
      onSubmit={(event) => void submit(event)}
      onChange={
        east ? (event) => setValues(readBirthForm(new FormData(event.currentTarget))) : undefined
      }
      className="grid gap-4"
    >
      {generalError ? (
        <FormAlert title={m.profiles_failed_title()}>
          {profileFailureMessage(failure.code)}
        </FormAlert>
      ) : null}
      <TextField
        label={m.profiles_field_label()}
        name="label"
        maxLength={40}
        autoComplete="off"
        defaultValue={profile?.label ?? ''}
        error={fieldIssue('label')}
      />
      <RelationSelect value={relation} onChange={setRelation} error={relationError} />
      {east ? (
        <div className="grid gap-4">
          <BirthFields
            values={values}
            locale={locale as EasternLocale}
            issues={birthIssues(issues)}
          />
        </div>
      ) : (
        <>
          <BirthDateField
            label={m.profiles_field_birth_date()}
            defaultValue={profile ? isoDate(profile.birth) : ''}
            invalid={dateMissing || Boolean(fieldIssue('day') ?? fieldIssue('year'))}
          />
          {dateMissing || fieldIssue('day') || fieldIssue('year') ? (
            <span role="alert" className="-mt-2 text-brand-ink text-sm">
              {m.numerology_date_invalid()}
            </span>
          ) : null}
          <TextField
            label={m.profiles_field_full_name()}
            name="fullName"
            autoComplete="off"
            maxLength={120}
            defaultValue={profile?.fullName ?? ''}
            error={fieldIssue('fullName')}
          />
        </>
      )}
      {profile?.isDefault ? null : (
        <CheckboxField label={m.profiles_field_default()} name="makeDefault" />
      )}
      <Button type="submit" size="lg" className="h-12 w-full" loading={busy}>
        {busy ? m.profiles_saving() : m.profiles_save()}
      </Button>
    </form>
  )
}
