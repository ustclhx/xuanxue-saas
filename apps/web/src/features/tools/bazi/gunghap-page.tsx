import type {
  BirthInput,
  CompatItem,
  CompatItemKey,
  Compatibility,
  InputIssue,
} from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { compatUnlock } from '../../readings/unlock-requests.ts'
import { useTool } from '../context.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import {
  BIRTH_STORAGE_KEY,
  type BirthFormValues,
  fromShareInput,
  KO_TRUE_SOLAR_DEFAULT,
  PARTNER_STORAGE_KEY,
  readBirthForm,
  toBirthInput,
  toShareInput,
} from './birth-form-state.ts'
import { PillarsGrid } from './chart-parts.tsx'
import {
  conceptHref,
  link,
  pageHref,
  ReadingSlots,
  ResultFooter,
  ResultStatus,
  usePrefetch,
} from './common.tsx'
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

const LOCALE = 'ko'
const A = 'a_'
const B = 'b_'

const ITEM_LABEL: Record<CompatItemKey, () => string> = {
  stemCombine: m.bazi_gunghap_item_stem_combine,
  branchSixCombine: m.bazi_gunghap_item_branch_six_combine,
  branchTriad: m.bazi_gunghap_item_branch_triad,
  branchClash: m.bazi_gunghap_item_branch_clash,
  branchPunish: m.bazi_gunghap_item_branch_punish,
  elementComplementAB: m.bazi_gunghap_item_element_complement_ab,
  elementComplementBA: m.bazi_gunghap_item_element_complement_ba,
}

type Issues = { a: readonly InputIssue[]; b: readonly InputIssue[] }

/**
 * 韩语 `/ko/사주궁합`（tasks.md 3.2）：同一张表单放两个人（字段加前缀），
 * 本人沿用만세력页面保存的输入，对方单独保存。分数的每一项可展开查看。
 */
export function GunghapPage() {
  const initial = { trueSolar: KO_TRUE_SOLAR_DEFAULT }
  const a = useBirthValues(BIRTH_STORAGE_KEY, LOCALE, initial)
  const b = useBirthValues(PARTNER_STORAGE_KEY, LOCALE, initial)
  const [state, setState] = useState<ToolState<Compatibility>>({ status: 'idle' })
  const [issues, setIssues] = useState<Issues>({ a: [], b: [] })
  const [submitted, setSubmitted] = useState<[BirthFormValues, BirthFormValues] | null>(null)
  const pendingScroll = useRef(false)
  usePrefetch(loadBazi)

  const run = useCallback(async (va: BirthFormValues, vb: BirthFormValues) => {
    const pa = toBirthInput(va)
    const pb = toBirthInput(vb)
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
    (shared) => {
      const va = fromShareInput(shared, a.defaults, A)
      const vb = fromShareInput(shared, b.defaults, B)
      if (!va || !vb) return
      a.restore(va)
      b.restore(vb)
      void run(va, vb)
    },
    () => {
      const sa = a.loadStored()
      const sb = b.loadStored()
      if (sa) a.restore(sa)
      if (sb) b.restore(sb)
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
  ) => (
    <fieldset className="m-0 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-4 rounded-lg border border-line p-3 sm:p-4">
      <legend className="px-1 font-heading text-ink text-lg">{legend}</legend>
      <BirthFields values={values} locale={LOCALE} prefix={prefix} issues={list} trueSolarCallout />
    </fieldset>
  )

  return (
    <ToolPage
      tool="saju-gunghap"
      title={m.bazi_gunghap_title()}
      intro={<p className="m-0">{m.bazi_gunghap_intro()}</p>}
      form={
        <ToolForm
          key={`${a.formKey}-${b.formKey}`}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={onSubmit}
          onChange={onChange}
          className="flex flex-col"
        >
          {person(m.bazi_gunghap_person_a(), a.values, A, issues.a)}
          {person(m.bazi_gunghap_person_b(), b.values, B, issues.b)}
          <SubmitButton className="self-stretch sm:self-end">
            {m.bazi_gunghap_submit()}
          </SubmitButton>
        </ToolForm>
      }
      result={
        state.status === 'idle' ? null : (
          <ResultStatus state={state}>
            {(result) => (
              <GunghapResult
                result={result}
                share={
                  submitted
                    ? { ...toShareInput(submitted[0], A), ...toShareInput(submitted[1], B) }
                    : {}
                }
              />
            )}
          </ResultStatus>
        )
      }
      links={[
        ...link(pageHref('home', LOCALE), m.bazi_link_home(), 'manseryeok'),
        ...link(
          conceptHref(LOCALE, 'day-pillar'),
          m.bazi_gunghap_block_pillars(),
          'concept-day-pillar',
        ),
        ...link(conceptHref(LOCALE, 'elements'), m.bazi_block_elements(), 'concept-elements'),
        ...link(conceptHref(LOCALE, 'useful-god'), m.bazi_link_useful(), 'concept-useful-god'),
      ]}
      faq={[
        { question: m.bazi_gunghap_faq_q1(), answer: m.bazi_gunghap_faq_a1() },
        { question: m.bazi_gunghap_faq_q2(), answer: m.bazi_gunghap_faq_a2() },
      ]}
    >
      <ReadingSlots tool="saju-gunghap">
        <ReadingUnlock
          kind="saju-compat"
          request={state.status === 'done' ? compatUnlock(submitted, [A, B]) : null}
        />
      </ReadingSlots>
    </ToolPage>
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
    return m.bazi_gunghap_detail_complement({ favorable, percent: String(detail.percent ?? 0) })
  }
  const glyph = (value: unknown) => {
    const key = String(value)
    return (
      (STEM_HANZI as Record<string, string>)[key] ??
      (BRANCH_HANZI as Record<string, string>)[key] ??
      key
    )
  }
  return m.bazi_gunghap_detail_pair({ a: glyph(detail.a), b: glyph(detail.b) })
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

export function GunghapResult({
  result,
  share,
}: {
  result: Compatibility
  share: Readonly<Record<string, unknown>>
}) {
  const { track } = useTool()
  const raw = result.items.reduce((sum, item) => sum + item.delta, result.base)
  return (
    <>
      <ResultBlock
        id="score"
        title={m.bazi_gunghap_block_score()}
        description={m.bazi_gunghap_desc_score({ base: String(result.base) })}
      >
        <p className="m-0 flex items-baseline gap-3">
          <span
            data-score={result.score}
            className="font-heading text-[48px] text-ink leading-none"
          >
            {m.bazi_gunghap_score({ score: String(result.score) })}
          </span>
          <span className="text-ink-subtle text-sm">{m.bazi_gunghap_score_label()}</span>
        </p>
        <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-brand"
            style={{ width: `${result.score}%` }}
          />
        </span>
        <details
          className="group rounded-lg border border-line"
          onToggle={(event) => {
            if (event.currentTarget.open) track('block_open', { block: 'score-breakdown' })
          }}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-ink marker:hidden">
            {m.bazi_gunghap_breakdown()}
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
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-line border-t">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink">
                  {m.bazi_gunghap_base()}
                </th>
                <td className="px-4 py-2.5 text-right tabular-nums">{result.base}</td>
              </tr>
              {result.items.map((item) => (
                <tr key={item.key} data-item={item.key} className="border-line border-t">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    <span className="block text-ink">{ITEM_LABEL[item.key]()}</span>
                    <span className="block text-ink-subtle text-xs">{itemDetail(item)}</span>
                  </th>
                  <td
                    className={cn(
                      'px-4 py-2.5 text-right font-semibold tabular-nums',
                      item.delta > 0
                        ? 'text-wx-wood'
                        : item.delta < 0
                          ? 'text-brand-ink'
                          : 'text-ink-subtle',
                    )}
                  >
                    {signed(item.delta)}
                  </td>
                </tr>
              ))}
              <tr className="border-line border-t">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink-muted">
                  {m.bazi_gunghap_total()}
                </th>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {raw === result.score ? result.score : `${raw} → ${result.score}`}
                </td>
              </tr>
            </tbody>
          </table>
        </details>
      </ResultBlock>
      <ResultBlock
        id="pillars"
        title={m.bazi_gunghap_block_pillars()}
        description={m.bazi_gunghap_desc_pillars()}
      >
        {result.charts.map((chart, i) => (
          <div key={chart.input.year + String(i)} className="flex flex-col gap-2">
            <h3 className="m-0 font-heading text-base text-ink">
              {i === 0 ? m.bazi_gunghap_person_a() : m.bazi_gunghap_person_b()} ·{' '}
              {m.bazi_gunghap_day_pillar({
                gz: ganzhi(chart.pillars.day.stem, chart.pillars.day.branch),
              })}
            </h3>
            <PillarsGrid chart={chart} locale={LOCALE} />
          </div>
        ))}
      </ResultBlock>
      <ResultFooter share={share} engineVersion={result.engineVersion} />
    </>
  )
}
