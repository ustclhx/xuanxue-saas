import type {
  BirthInput,
  CompatItem,
  CompatItemKey,
  Compatibility,
  InputIssue,
} from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import type { EastLocale } from '../../i18n/locales.ts'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { COMPAT_READING_LOCALES } from '../../readings/release.ts'
import { ReadingComingSoon, ReadingUnlock } from '../../readings/unlock-card.tsx'
import { compatUnlock } from '../../readings/unlock-requests.ts'
import { useTool } from '../context.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import {
  BIRTH_STORAGE_KEY,
  type BirthFormValues,
  clearLegacyPartner,
  fromShareInput,
  KO_TRUE_SOLAR_DEFAULT,
  readBirthForm,
  sessionStore,
  toBirthInput,
} from './birth-form-state.ts'
import { PillarsGrid } from './chart-parts.tsx'
import {
  conceptHref,
  link,
  localPageHref,
  pageHref,
  ReadingSlots,
  ResultFooter,
  ResultStatus,
  usePrefetch,
} from './common.tsx'
import {
  type CompatScenario,
  type CompatSummary,
  fromCompatShare,
  toCompatShare,
} from './compat-share.ts'
import { loadBazi } from './engine.ts'
import { BRANCH_HANZI, ganzhi, STEM_HANZI } from './glyphs.ts'
import { ELEMENT_LABEL } from './labels.ts'
import {
  inputIssuesOf,
  scrollToResult,
  type ToolState,
  useBirthValues,
  useShareFragment,
} from './use-birth-tool.ts'

/** 合盘工具的语言：东方站各语言与东方站根路径英文（content-growth-v2-tools 决策 2） */
export type CompatLocale = EastLocale | 'en'

const A = 'a_'
const B = 'b_'

const ITEM_LABEL: Record<CompatItemKey, () => string> = {
  stemCombine: m.compat_item_stem_combine,
  branchSixCombine: m.compat_item_branch_six_combine,
  branchTriad: m.compat_item_branch_triad,
  branchClash: m.compat_item_branch_clash,
  branchPunish: m.compat_item_branch_punish,
  elementComplementAB: m.compat_item_element_complement_ab,
  elementComplementBA: m.compat_item_element_complement_ba,
}

type Issues = { a: readonly InputIssue[]; b: readonly InputIssue[] }

/** 四柱的排列与标签：英文页沿用繁中命盘（干支用汉字，与 /bazi-calculator 相同） */
const chartLocale = (locale: CompatLocale): EastLocale => (locale === 'en' ? 'zh-Hant' : locale)

/**
 * 八字合盘 / 사주궁합 / 四柱推命の相性 / BaZi Compatibility（content-growth-v2-tools 12.1；原为 ko 专用，
 * add-bazi-saju-chart tasks.md 3.2）：同一张表单放两个人（字段加前缀），本人沿用排盘页保存的输入。
 * 对方资料是第三方个人数据（决策 7）：不写入浏览器存储，表单内常显用途说明，分享片段只带分数与关系。
 * 版式套用工具页模板（设计稿 warm-refresh/ToolBazi.dc.html；content-growth-v2-tools/Hehun.dc.html 的
 * DuoBirthForm 与 ScoreMeter）：H1、简介、表单 → 结果 → 长文 → FAQ → 内链。
 * `$slug` 路由不传参数，语言取当前请求；场景页（第 13 组）传入 `scenario` 与正文。
 */
export function GunghapPage({
  locale: localeProp,
  scenario = 'general',
  title,
  intro,
  article,
}: {
  locale?: CompatLocale
  scenario?: CompatScenario
  /** 场景页的 H1 与简介；省略时为工具页文案 */
  title?: string
  intro?: ReactNode
  /** 长文（第 13 组 compat 集合） */
  article?: ReactNode
} = {}) {
  const locale = localeProp ?? (getLocale() as CompatLocale)
  // 默认值只在挂载时读取：韩语页진태양시默认开启（决策 D5），其他语言与排盘页相同
  const initial = locale === 'ko' ? { trueSolar: KO_TRUE_SOLAR_DEFAULT } : undefined
  const a = useBirthValues(BIRTH_STORAGE_KEY, locale, initial)
  const b = useBirthValues(null, locale, initial)
  const [state, setState] = useState<ToolState<Compatibility>>({ status: 'idle' })
  const [shared, setShared] = useState<CompatSummary | null>(null)
  const [issues, setIssues] = useState<Issues>({ a: [], b: [] })
  const [submitted, setSubmitted] = useState<[BirthFormValues, BirthFormValues] | null>(null)
  const pendingScroll = useRef(false)
  usePrefetch(loadBazi)

  // 旧版把对方资料写在 sessionStorage：首次加载新版时清除残留（决策 7 迁移）
  useEffect(() => clearLegacyPartner(sessionStore()), [])

  const run = useCallback(async (va: BirthFormValues, vb: BirthFormValues) => {
    const pa = toBirthInput(va)
    const pb = toBirthInput(vb)
    setShared(null)
    if (!pa.ok || !pb.ok) {
      setIssues({ a: pa.ok ? [] : pa.issues, b: pb.ok ? [] : pb.issues })
      setState({ status: 'idle' })
      return
    }
    setState({ status: 'loading' })
    try {
      const engine = await loadBazi()
      // 分别校验，错误显示在对应的人名下
      const ia = engine.validateInput(pa.input)
      const ib = engine.validateInput(pb.input)
      setIssues({ a: ia, b: ib })
      if (ia.length > 0 || ib.length > 0) {
        setState({ status: 'idle' })
        return
      }
      const result = engine.computeCompatibility(pa.input as BirthInput, pb.input as BirthInput, {
        referenceYear: new Date().getFullYear(),
      })
      setSubmitted([va, vb])
      pendingScroll.current = true
      setState({ status: 'done', result })
    } catch (error) {
      setState(inputIssuesOf(error) ? { status: 'idle' } : { status: 'error' })
    }
  }, [])

  useEffect(() => {
    if (state.status === 'done' && pendingScroll.current) {
      pendingScroll.current = false
      scrollToResult()
    }
  }, [state])

  useShareFragment(
    (fragment) => {
      // 新版分享片段只有分数与关系：直接展示，不填表单、不重新计算
      const summary = fromCompatShare(fragment)
      if (summary) {
        setShared(summary)
        return
      }
      // 旧版分享链接与详批登录 / 支付回跳（unlock-card 把令牌中的输入写成 `#r=`）带两人资料：兼容读取并重算
      const va = fromShareInput(fragment, a.defaults, A)
      const vb = fromShareInput(fragment, b.defaults, B)
      if (!va || !vb) return
      a.restore(va)
      b.restore(vb)
      void run(va, vb)
    },
    () => {
      const sa = a.loadStored()
      if (sa) a.restore(sa)
    },
  )

  const onChange = (data: FormData) => {
    a.update(readBirthForm(data, A))
    b.update(readBirthForm(data, B))
  }
  const onSubmit = (data: FormData) => {
    const va = readBirthForm(data, A)
    const vb = readBirthForm(data, B)
    a.update(va)
    b.update(vb)
    void run(va, vb)
  }

  const person = (
    legend: string,
    values: BirthFormValues,
    prefix: string,
    list: readonly InputIssue[],
    fill: (values: Partial<BirthFormValues>) => void,
  ) => (
    <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-1 p-0 font-heading text-ink text-subtitle">{legend}</legend>
      {/* 双人各自从档案填入（6.2）；填入一方不改动另一方的输入。对方只在访客点击时填入或另存为档案 */}
      <ProfileBar target={{ kind: 'birth', tool: 'bazi', prefix, onFill: fill }} />
      {/* 两组出生信息已很长：진태양시 说明收进进阶选项（默认仍开启），展开后可关闭 */}
      <BirthFields
        values={values}
        locale={locale}
        prefix={prefix}
        issues={list}
        trueSolarCallout
        advancedCollapsed
      />
    </fieldset>
  )

  const offered = COMPAT_READING_LOCALES.includes(locale)
  const ziwei = locale === 'ko' ? undefined : localPageHref('ziwei', locale)
  return (
    <ToolPage
      tool="saju-gunghap"
      title={title ?? m.compat_title()}
      intro={intro ?? <p className="m-0">{m.compat_intro()}</p>}
      form={
        <ToolForm
          key={`${a.formKey}-${b.formKey}`}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={onSubmit}
          onChange={onChange}
          className="flex flex-col gap-y-6"
        >
          {person(m.compat_person_a(), a.values, A, issues.a, a.fill)}
          {person(m.compat_person_b(), b.values, B, issues.b, b.fill)}
          <PartnerNote />
          {/*
            两组出生信息在手机上超过一屏（390×844）：提交按钮吸附在视口底部，首屏即可见（tool-pages「工具页紧凑布局」），
            滚到表单末尾时回到原位。底色与表单面板相同，避免字段从按钮下方透出。
          */}
          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 rounded-b-object bg-surface px-6 py-3 sm:static sm:m-0 sm:p-0 print:static">
            <SubmitButton>{m.compat_submit()}</SubmitButton>
          </div>
        </ToolForm>
      }
      result={
        state.status !== 'idle' ? (
          <ResultStatus state={state}>
            {(result) => (
              <GunghapResult
                result={result}
                locale={locale}
                share={toCompatShare(result, scenario)}
              />
            )}
          </ResultStatus>
        ) : shared ? (
          <SharedGunghapResult summary={shared} />
        ) : null
      }
      links={[
        ...link(
          pageHref('bazi', locale),
          m.bazi_link_home(),
          locale === 'ko' ? 'manseryeok' : 'bazi',
        ),
        ...(ziwei ? link(ziwei, m.bazi_link_ziwei(), 'ziwei') : []),
        ...link(conceptHref(locale, 'day-pillar'), m.compat_block_pillars(), 'concept-day-pillar'),
        ...link(conceptHref(locale, 'elements'), m.bazi_block_elements(), 'concept-elements'),
        ...link(conceptHref(locale, 'useful-god'), m.bazi_link_useful(), 'concept-useful-god'),
      ]}
      article={article}
      faq={[
        { question: m.compat_faq_q1(), answer: m.compat_faq_a1() },
        { question: m.compat_faq_q2(), answer: m.compat_faq_a2() },
      ]}
    >
      <ReadingSlots tool="saju-gunghap">
        {offered ? (
          <ReadingUnlock
            kind="saju-compat"
            request={state.status === 'done' ? compatUnlock(submitted, [A, B]) : null}
            note={m.compat_unlock_partner_note()}
          />
        ) : state.status === 'done' ? (
          // 该语言的合盘详批尚未开放（第 14 组评测与使用者审阅之前）：免费结果照常，解锁位置显示占位
          <ReadingComingSoon kind="saju-compat" />
        ) : null}
      </ReadingSlots>
    </ToolPage>
  )
}

/**
 * 对方资料的用途说明（设计稿 Proposals.dc.html「DuoBirthForm」）：surface-2 底、锁形图标，
 * 放在提交按钮上方，始终可见，不收进折叠或提示气泡。
 */
function PartnerNote() {
  return (
    <p
      data-partner-note=""
      className="m-0 flex items-start gap-2.5 rounded-field bg-surface-2 px-4 py-3 text-caption text-ink-muted"
    >
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
        className="mt-0.5 shrink-0 text-ink-subtle"
      >
        <rect x="4" y="9" width="12" height="8" rx="1.5" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      </svg>
      <span>{m.compat_partner_note()}</span>
    </p>
  )
}

function itemDetail(item: CompatItem): string {
  const { detail } = item
  if (item.key === 'elementComplementAB' || item.key === 'elementComplementBA') {
    const favorable = String(detail.favorable ?? '')
      .split(',')
      .filter((e): e is keyof typeof ELEMENT_LABEL => e in ELEMENT_LABEL)
      .map((e) => ELEMENT_LABEL[e]())
      .join('·')
    return m.compat_detail_complement({ favorable, percent: String(detail.percent ?? 0) })
  }
  const glyph = (value: unknown) => {
    const key = String(value)
    return (
      (STEM_HANZI as Record<string, string>)[key] ??
      (BRANCH_HANZI as Record<string, string>)[key] ??
      key
    )
  }
  return m.compat_detail_pair({ a: glyph(detail.a), b: glyph(detail.b) })
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

/**
 * 参考分区块（设计稿 Proposals.dc.html「ScoreMeter」）：100 分制的数字与进度条，不分档、不配评语、不用红绿色；
 * 区块说明固定写明分数只表示命中的传统规则。分项可展开；分享结果没有分项依据（干支）时只列名称与加减分。
 */
function ScoreBlock({
  score,
  base,
  items,
  notes,
}: {
  score: number
  base: number
  items: readonly { key: CompatItemKey; delta: number; detail?: string }[]
  notes?: ReactNode
}) {
  const { track } = useTool()
  const raw = items.reduce((sum, item) => sum + item.delta, base)
  return (
    <ResultBlock
      id="score"
      title={m.compat_block_score()}
      description={m.compat_desc_score({ base: String(base) })}
    >
      {notes}
      <p className="m-0 flex items-baseline gap-3">
        <span data-score={score} className="font-heading text-display text-ink">
          {m.compat_score({ score: String(score) })}
        </span>
        <span className="text-caption text-ink-subtle">{m.compat_score_label()}</span>
      </p>
      {/* 进度条只是数字的图示，读屏读上方的分数文字（不另用 meter，样式与 ko 原版一致） */}
      <span className="block h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${score}%` }} />
      </span>
      <details
        className="group rounded-field bg-surface-2"
        onToggle={(event) => {
          if (event.currentTarget.open) track('block_open', { block: 'score-breakdown' })
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-field px-4 text-body text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
          {m.compat_breakdown()}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </summary>
        <table className="w-full border-collapse text-body text-ink">
          <tbody>
            <tr className="border-line border-t">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink">
                {m.compat_base()}
              </th>
              <td className="px-4 py-2.5 text-right tabular-nums">{base}</td>
            </tr>
            {items.map((item) => (
              <tr key={item.key} data-item={item.key} className="border-line border-t">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="block text-ink">{ITEM_LABEL[item.key]()}</span>
                  {item.detail !== undefined && (
                    <span className="block text-caption text-ink-subtle">{item.detail}</span>
                  )}
                </th>
                <td
                  className={cn(
                    // 加减分靠正负号区分，不用五行色
                    'px-4 py-2.5 text-right font-medium tabular-nums',
                    item.delta === 0 && 'text-ink-subtle',
                  )}
                >
                  {signed(item.delta)}
                </td>
              </tr>
            ))}
            <tr className="border-line border-t">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink-muted">
                {m.compat_total()}
              </th>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                {raw === score ? score : `${raw} → ${score}`}
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </ResultBlock>
  )
}

/** 结果区的提示行（时辰未知、分享结果）：与表单内说明同一样式 */
function ResultNote({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="m-0 rounded-field bg-surface-2 px-4 py-3 text-caption text-ink-muted">
      {children}
    </p>
  )
}

export function GunghapResult({
  result,
  share,
  locale = 'ko',
}: {
  result: Compatibility
  share: Readonly<Record<string, unknown>>
  locale?: CompatLocale
}) {
  const label = (i: number): string => (i === 0 ? m.compat_person_a() : m.compat_person_b())
  // 时辰未知时按三柱排盘（设计稿 HehunEdge.dc.html）：分数规则不变，只说明五行一项按六个字统计
  const unknown = result.charts.flatMap((chart, i) => (chart.input.time === null ? [label(i)] : []))
  return (
    <>
      <ScoreBlock
        score={result.score}
        base={result.base}
        items={result.items.map((item) => ({ ...item, detail: itemDetail(item) }))}
        notes={unknown.map((person) => (
          <ResultNote key={person}>{m.compat_unknown_time({ person })}</ResultNote>
        ))}
      />
      <ResultBlock
        id="pillars"
        title={m.compat_block_pillars()}
        description={m.compat_desc_pillars()}
      >
        {result.charts.map((chart, i) => (
          <div key={chart.input.year + String(i)} className="flex flex-col gap-2">
            <h3 className="m-0 font-heading text-body text-ink">
              {label(i)} ·{' '}
              {m.compat_day_pillar({
                gz: ganzhi(chart.pillars.day.stem, chart.pillars.day.branch),
              })}
            </h3>
            <PillarsGrid chart={chart} locale={chartLocale(locale)} />
          </div>
        ))}
      </ResultBlock>
      <ResultFooter share={share} engineVersion={result.engineVersion} />
    </>
  )
}

/** 新版分享链接打开时：只有分数与各项关系，不含出生资料，不显示四柱 */
export function SharedGunghapResult({ summary }: { summary: CompatSummary }) {
  return (
    <ScoreBlock
      score={summary.score}
      base={summary.base}
      items={summary.items}
      notes={<ResultNote>{m.compat_shared_note()}</ResultNote>}
    />
  )
}
