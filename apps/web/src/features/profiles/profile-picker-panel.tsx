import { Link } from '@tanstack/react-router'
import type { BirthProfileBirth, BirthProfileRelation } from '@xuanxue/db'
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@xuanxue/ui'
import { type FormEvent, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { readBirthForm, toBirthInput } from '../tools/bazi/birth-form-state.ts'
import { CheckboxField, TextField } from '../tools/form.tsx'
import {
  birthDateText,
  profileFailureMessage,
  profileIssueMessage,
  profileName,
  RELATION_LABEL,
} from './labels.ts'
import { type BirthPrefillField, type NumerologyPrefillField, profileFor } from './prefill.ts'
import type { BarNotice, ProfileBarTarget } from './profile-bar.tsx'
import { FormAlert, RelationSelect } from './profile-editor.tsx'
import {
  createBirthProfile,
  listBirthProfiles,
  type ProfileFailureCode,
} from './profiles.functions.ts'
import type { BirthProfile, ProfileIssue } from './schema.ts'

/**
 * 工具页档案入口的按需部分（profile-bar.tsx 点击后才加载）：档案选择列表与「另存为档案」对话框。
 * 档案列表在首次打开时请求一次，同一页面会话内缓存在内存中；保存新档案后清除缓存。
 */

let cached: { slug: string; list: Promise<BirthProfile[]> } | undefined

export function loadProfiles(slug: string): Promise<BirthProfile[]> {
  if (cached?.slug !== slug) {
    const list = listBirthProfiles({ data: { slug } })
    cached = { slug, list }
    // 失败后允许下次打开时重试
    list.catch(() => {
      if (cached?.list === list) cached = undefined
    })
  }
  return cached.list
}

export function clearProfileCache(): void {
  cached = undefined
}

const MISSING_TEXT: Record<BirthPrefillField | NumerologyPrefillField, () => string> = {
  gender: m.profiles_missing_gender,
  location: m.profiles_missing_location,
  time: m.profiles_missing_time,
  birthDate: m.profiles_missing_birth_date,
}

/** 给非受控控件写值（数字命理表单） */
function setControl(form: HTMLFormElement | null, name: string, value: string) {
  const control = form?.elements.namedItem(name)
  if (control instanceof HTMLInputElement) control.value = value
}

/**
 * 把档案换成表单值：东方站交给页面重新挂载表单，西方站直接写入所在表单的控件。
 * 返回提示，列出需要用户补全的字段（不猜测缺失值）。
 */
export function fillFromProfile(
  target: ProfileBarTarget,
  profile: BirthProfile,
  form: HTMLFormElement | null,
  beforeFill?: (notice: BarNotice) => void,
): BarNotice {
  const notice = (missing: (BirthPrefillField | NumerologyPrefillField)[]): BarNotice => ({
    text: m.profiles_filled({ name: profileName(profile) }),
    hints: missing.map((field) => MISSING_TEXT[field]()),
  })
  let missing: (BirthPrefillField | NumerologyPrefillField)[]
  if (target.kind === 'birth') {
    const prefill = profileFor(target.tool, profile)
    beforeFill?.(notice(prefill.missing))
    target.onFill(prefill.values)
    missing = prefill.missing
  } else {
    const prefill = profileFor('numerology', profile)
    if (target.date && prefill.values.birthDate)
      setControl(form, 'birthDate', prefill.values.birthDate)
    if (target.name && prefill.values.name) setControl(form, 'name', prefill.values.name)
    missing = target.date ? prefill.missing : []
  }
  return notice(missing)
}

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; profiles: BirthProfile[] }

export default function ProfilePickerPanel({
  slug,
  target,
  form,
  onBeforeFill,
  onDone,
}: {
  slug: string
  target: ProfileBarTarget
  /** 所在的工具表单（数字命理直接写控件值） */
  form: () => HTMLFormElement | null
  /** 东方站填入会重新挂载表单，提示先交给入口暂存 */
  onBeforeFill?: (notice: BarNotice) => void
  onDone: (notice: BarNotice) => void
}) {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    loadProfiles(slug).then(
      (profiles) => active && setState({ status: 'ready', profiles }),
      () => active && setState({ status: 'error' }),
    )
    return () => {
      active = false
    }
  }, [slug])

  if (state.status === 'loading')
    return (
      <p role="status" className="m-0 text-ink-muted text-sm">
        {m.profiles_pick_loading()}
      </p>
    )
  if (state.status === 'error')
    return (
      <p role="alert" className="m-0 text-brand-ink text-sm">
        {m.profiles_pick_error()}
      </p>
    )
  if (state.profiles.length === 0)
    return (
      <p className="m-0 flex flex-wrap items-center gap-x-3 text-ink-muted text-sm">
        {m.profiles_pick_empty()}
        <ManageLink slug={slug} />
      </p>
    )
  return (
    <div className="flex flex-col gap-1">
      <ul
        aria-label={m.profiles_pick_label()}
        className="m-0 flex list-none flex-col rounded-xl border border-line bg-background p-1"
      >
        {state.profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              onClick={() => onDone(fillFromProfile(target, profile, form(), onBeforeFill))}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-base text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 break-words">
                {profileName(profile)}
                {profile.label ? (
                  <span className="text-ink-subtle text-sm">
                    {' · '}
                    {RELATION_LABEL[profile.relation]()}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-ink-subtle text-sm tabular-nums">
                {birthDateText(profile.birth)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ManageLink slug={slug} className="self-end" />
    </div>
  )
}

function ManageLink({ slug, className }: { slug: string; className?: string }) {
  return (
    <Link
      to="/app/$slug/profiles"
      params={{ slug }}
      className={cn(
        'inline-flex min-h-11 items-center text-brand-ink text-sm underline-offset-4 hover:underline',
        className,
      )}
    >
      {m.profiles_manage()}
    </Link>
  )
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 待保存的档案字段；表单不完整时为 null。只做必填与格式检查，语义规则由服务端判断 */
export function draftFromForm(
  target: ProfileBarTarget,
  data: FormData,
): { birth: BirthProfileBirth; fullName: string | null } | null {
  if (target.kind === 'birth') {
    const parsed = toBirthInput(readBirthForm(data, target.prefix ?? ''))
    return parsed.ok ? { birth: parsed.input, fullName: null } : null
  }
  const match = DATE.exec(String(data.get('birthDate') ?? ''))
  if (!target.date || !match) return null
  const name = target.name ? String(data.get('name') ?? '').trim() : ''
  return {
    birth: {
      calendar: 'solar',
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      time: null,
      gender: null,
      location: null,
    },
    fullName: name || null,
  }
}

/**
 * 「另存为档案」：读取所在表单的当前输入（不完整时直接提示，不打开对话框），
 * 用户填写显示名、关系与是否设为默认后保存。表单内容保持不变。
 */
export function SaveProfileDialog({
  slug,
  target,
  form,
  onDone,
}: {
  slug: string
  target: ProfileBarTarget
  form: HTMLFormElement
  onDone: (notice: BarNotice | null) => void
}) {
  const [draft] = useState(() => draftFromForm(target, new FormData(form)))
  const [relation, setRelation] = useState<BirthProfileRelation>('self')
  const [failure, setFailure] = useState<{
    code: ProfileFailureCode | 'UNKNOWN'
    issues: ProfileIssue[]
  } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!draft) onDone({ text: m.profiles_save_incomplete(), hints: [] })
  }, [draft, onDone])
  if (!draft) return null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // 对话框是独立的表单，不触发外层工具表单的提交
    event.stopPropagation()
    const data = new FormData(event.currentTarget)
    const label = String(data.get('label') ?? '').trim()
    setBusy(true)
    setFailure(null)
    try {
      const result = await createBirthProfile({
        data: {
          slug,
          profile: {
            label: label || null,
            relation,
            birth: draft.birth as unknown as Record<string, unknown>,
            fullName: draft.fullName,
          },
          makeDefault: data.has('makeDefault'),
        },
      })
      if (!result.ok) {
        setFailure({ code: result.code, issues: result.issues })
        return
      }
      clearProfileCache()
      onDone({ text: m.profiles_saved_as({ name: profileName(result.value) }), hints: [] })
    } catch {
      setFailure({ code: 'UNKNOWN', issues: [] })
    } finally {
      setBusy(false)
    }
  }

  const issue = failure?.issues.find((item) => item.field !== 'relation' && item.field !== 'label')
  const message =
    failure === null
      ? null
      : failure.code === 'INVALID_PROFILE' && issue
        ? profileIssueMessage(issue)
        : profileFailureMessage(failure.code)
  return (
    <Dialog open onOpenChange={(open) => !open && onDone(null)}>
      <DialogContent closeLabel={m.profiles_close()}>
        <DialogHeader>
          <DialogTitle>{m.profiles_save_title()}</DialogTitle>
          <DialogDescription>{m.profiles_save_desc()}</DialogDescription>
        </DialogHeader>
        <form
          aria-label={m.profiles_save_title()}
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          {message ? <FormAlert title={m.profiles_failed_title()}>{message}</FormAlert> : null}
          <p className="m-0 text-ink-muted text-sm tabular-nums">{birthDateText(draft.birth)}</p>
          <TextField
            label={m.profiles_field_label()}
            name="label"
            maxLength={40}
            autoComplete="off"
          />
          <RelationSelect value={relation} onChange={setRelation} />
          <CheckboxField label={m.profiles_field_default()} name="makeDefault" />
          <DialogFooter className="mt-2">
            <Button type="submit" size="lg" className="h-11" loading={busy}>
              {busy ? m.profiles_saving() : m.profiles_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
