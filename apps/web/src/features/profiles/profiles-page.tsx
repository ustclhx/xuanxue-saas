import type { BirthInput, Stem } from '@xuanxue/bazi'
import type { SiteId } from '@xuanxue/config'
import { lifePath } from '@xuanxue/numerology'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  cn,
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
  MenuItem,
} from '@xuanxue/ui'
import { Ellipsis } from '@xuanxue/ui/icons'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { toShareInput } from '../tools/bazi/birth-form-state.ts'
import { pageHref } from '../tools/bazi/common.tsx'
import { loadBazi } from '../tools/bazi/engine.ts'
import { STEM_ELEMENT, STEM_HANZI } from '../tools/bazi/glyphs.ts'
import { ELEMENT_LABEL } from '../tools/bazi/labels.ts'
import { NUMEROLOGY_TOOLS } from '../tools/numerology/routes.ts'
import { encodeShareInput } from '../tools/share.ts'
import {
  birthSummary,
  MAX_PROFILES,
  profileFailureMessage,
  profileName,
  RELATION_LABEL,
} from './labels.ts'
import { formValuesOf, profileFor } from './prefill.ts'
import { FormAlert, ProfileEditor } from './profile-editor.tsx'
import {
  deleteBirthProfile,
  listBirthProfiles,
  type ProfileFailureCode,
  setDefaultBirthProfile,
} from './profiles.functions.ts'
import type { BirthProfile } from './schema.ts'

/**
 * `/app/$slug/profiles` 出生档案管理页（原型 Profiles.dc.html、ProfileEdit.dc.html、States.dc.html）：
 * 列表（名称与默认标记、关系、出生摘要、日主或生命灵数）、新建 / 编辑抽屉、设为默认与删除确认。
 * 日主在浏览器按需加载排盘引擎计算，不进入服务端查询；「排盘」链接用 `#r=` 片段，不含姓名。
 */

type Editing = { open: boolean; profile?: BirthProfile | undefined }
type Notice =
  | { kind: 'status'; text: string }
  | { kind: 'error'; code: ProfileFailureCode | 'UNKNOWN' }

/** 东方站：日主「庚金」；引擎按需加载，失败时该列留空 */
function useDayMasters(profiles: readonly BirthProfile[], site: SiteId) {
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    if (site === 'west') {
      const next: Record<string, string> = {}
      for (const profile of profiles) {
        const { birth } = profile
        if (birth.calendar !== 'solar') continue
        try {
          next[profile.id] = String(lifePath(birth).value)
        } catch {
          // 引擎拒绝的日期不显示数字
        }
      }
      setValues(next)
      return
    }
    let active = true
    void loadBazi()
      .then((engine) => {
        const next: Record<string, string> = {}
        const referenceYear = new Date().getFullYear()
        for (const profile of profiles) {
          const { birth } = profile
          if (!birth.gender || !birth.location) continue
          try {
            const chart = engine.computeChart(birth as BirthInput, { referenceYear })
            const stem: Stem = chart.dayMaster
            next[profile.id] = `${STEM_HANZI[stem]}${ELEMENT_LABEL[STEM_ELEMENT[stem]]()}`
          } catch {
            // 单份档案计算失败不影响其他行
          }
        }
        if (active) setValues(next)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [profiles, site])
  return values
}

/** 「排盘」：东方站进入排盘首页，西方站进入完整计算器；输入放在 `#r=` 片段，不含姓名 */
export function toolLink(profile: BirthProfile, site: SiteId, locale: string): string {
  if (site === 'west') {
    const date = profileFor('numerology', profile).values.birthDate
    const path = NUMEROLOGY_TOOLS['numerology-calculator'].path
    return date ? `${path}#r=${encodeShareInput({ date })}` : path
  }
  return `${pageHref('home', locale)}#r=${encodeShareInput(toShareInput(formValuesOf(profile, locale)))}`
}

export function ProfilesPage({
  slug,
  site,
  locale,
  initial,
}: {
  slug: string
  site: SiteId
  locale: string
  initial: readonly BirthProfile[]
}) {
  const [profiles, setProfiles] = useState<readonly BirthProfile[]>(initial)
  const [editing, setEditing] = useState<Editing>({ open: false })
  const [deleting, setDeleting] = useState<BirthProfile | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const dayMasters = useDayMasters(profiles, site)
  const full = profiles.length >= MAX_PROFILES
  const hasSelf = profiles.some((profile) => profile.relation === 'self')

  useEffect(() => setProfiles(initial), [initial])

  /** 写操作后重新读取：默认档案可能已转移，排序按更新时间变化 */
  const reload = async (text: string) => {
    try {
      setProfiles(await listBirthProfiles({ data: { slug } }))
      setNotice({ kind: 'status', text })
    } catch {
      setNotice({ kind: 'error', code: 'UNKNOWN' })
    }
  }
  const act = async (
    run: () => Promise<{ ok: boolean; code?: ProfileFailureCode }>,
    text: string,
  ) => {
    try {
      const result = await run()
      if (!result.ok) {
        setNotice({ kind: 'error', code: result.code ?? 'UNKNOWN' })
        return
      }
      await reload(text)
    } catch {
      setNotice({ kind: 'error', code: 'UNKNOWN' })
    }
  }
  const openNew = () => {
    setNotice(full ? { kind: 'error', code: 'PROFILE_LIMIT' } : null)
    if (!full) setEditing({ open: true })
  }

  return (
    <section aria-labelledby="profiles-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 id="profiles-title" className="m-0 font-heading font-semibold text-2xl text-ink">
            {m.profiles_title()}
          </h1>
          <p className="m-0 text-base text-ink-muted">
            {m.profiles_intro()}
            {profiles.length > 0
              ? m.profiles_count({ count: profiles.length, max: MAX_PROFILES })
              : null}
          </p>
        </div>
        {profiles.length > 0 ? (
          <Button size="lg" className="h-11" onClick={openNew}>
            {m.profiles_new()}
          </Button>
        ) : null}
      </div>

      <div aria-live="polite">
        {notice?.kind === 'status' ? (
          <p role="status" className="m-0 text-ink-muted text-sm">
            {notice.text}
          </p>
        ) : notice?.kind === 'error' ? (
          <FormAlert title={m.profiles_failed_title()}>
            {profileFailureMessage(notice.code)}
          </FormAlert>
        ) : null}
      </div>

      {profiles.length === 0 ? (
        <EmptyProfiles onCreate={openNew} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table aria-label={m.profiles_list_label()} className="w-full border-collapse text-base">
            <thead className="hidden bg-surface-2 text-left md:table-header-group">
              <tr>
                <th className="px-4 py-3 font-semibold">{m.profiles_col_name()}</th>
                <th className="px-4 py-3 font-semibold">{m.profiles_col_relation()}</th>
                <th className="px-4 py-3 font-semibold">{m.profiles_col_birth()}</th>
                <th className="px-4 py-3 font-semibold">
                  {site === 'east' ? m.profiles_col_day_master() : m.profiles_col_life_path()}
                </th>
                <th className="px-4 py-3">
                  <span className="sr-only">{m.profiles_col_actions()}</span>
                </th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {profiles.map((profile) => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  site={site}
                  locale={locale}
                  dayMaster={dayMasters[profile.id]}
                  onEdit={() => {
                    setNotice(null)
                    setEditing({ open: true, profile })
                  }}
                  onSetDefault={() =>
                    void act(
                      () => setDefaultBirthProfile({ data: { slug, id: profile.id } }),
                      m.profiles_status_default(),
                    )
                  }
                  onDelete={() => setDeleting(profile)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="m-0 text-ink-subtle text-sm">{m.profiles_footnote()}</p>

      <ProfileEditor
        open={editing.open}
        onOpenChange={(open) => setEditing((current) => ({ ...current, open }))}
        slug={slug}
        site={site}
        locale={locale}
        profile={editing.profile}
        defaultRelation={hasSelf ? 'other' : 'self'}
        onSaved={() => {
          setEditing((current) => ({ ...current, open: false }))
          void reload(m.profiles_status_saved())
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.profiles_delete_title({ name: deleting ? profileName(deleting) : '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{m.profiles_delete_body()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.profiles_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = deleting
                setDeleting(null)
                if (target)
                  void act(
                    () => deleteBirthProfile({ data: { slug, id: target.id } }),
                    m.profiles_status_deleted(),
                  )
              }}
            >
              {m.profiles_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function ProfileRow({
  profile,
  site,
  locale,
  dayMaster,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  profile: BirthProfile
  site: SiteId
  locale: string
  dayMaster: string | undefined
  onEdit: () => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  const name = profileName(profile)
  return (
    <tr
      data-profile-id={profile.id}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-line border-t px-4 py-3 first:border-t-0 md:table-row md:px-0 md:py-0 md:first:border-t"
    >
      <td className="flex w-full min-w-0 items-center gap-2 md:table-cell md:w-auto md:px-4 md:py-3.5">
        <strong className="break-words font-semibold text-ink">{name}</strong>
        {profile.isDefault ? (
          <Badge color="accent" className="ml-1.5">
            {m.profiles_badge_default()}
          </Badge>
        ) : null}
      </td>
      <td className="text-ink-muted md:table-cell md:px-4 md:py-3.5">
        {RELATION_LABEL[profile.relation]()}
      </td>
      <td className="text-ink-muted tabular-nums md:table-cell md:px-4 md:py-3.5">
        {birthSummary(profile.birth)}
      </td>
      <td
        className={cn(
          'text-ink md:table-cell md:px-4 md:py-3.5',
          site === 'east' ? 'font-heading' : 'font-semibold tabular-nums',
        )}
      >
        {dayMaster ?? <span className="sr-only">{m.profiles_computing()}</span>}
      </td>
      <td className="-mr-2 ml-auto flex items-center gap-1 md:table-cell md:px-4 md:py-2 md:text-right md:whitespace-nowrap">
        <a
          href={toolLink(profile, site, locale)}
          className="inline-flex h-11 items-center rounded-lg px-2.5 text-brand-ink underline-offset-4 hover:underline"
        >
          {m.profiles_open_tool()}
        </a>
        <Button variant="ghost" className="h-11" onClick={onEdit}>
          {m.profiles_edit()}
        </Button>
        <DropdownMenu>
          <DropdownTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={m.profiles_more_actions({ name })}
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            }
          />
          <DropdownContent align="end">
            {profile.isDefault ? null : (
              <MenuItem index={0} label={m.profiles_set_default()} onSelect={onSetDefault} />
            )}
            <MenuItem
              index={profile.isDefault ? 0 : 1}
              label={m.profiles_delete()}
              onSelect={onDelete}
            />
          </DropdownContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function EmptyProfiles({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-5 py-7 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="text-line-strong"
      >
        <rect
          x="8"
          y="6"
          width="24"
          height="28"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M14 14h12M14 20h12M14 26h7" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <h2 className="m-0 font-semibold text-ink text-lg">{m.profiles_empty_title()}</h2>
      <p className="m-0 text-ink-muted text-sm leading-relaxed">{m.profiles_empty_body()}</p>
      <Button size="lg" className="h-11" onClick={onCreate}>
        {m.profiles_empty_cta()}
      </Button>
    </div>
  )
}
