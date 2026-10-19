import type { BaziChart, PillarKey } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { m } from '../../../paraglide/messages.js'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { toShareInput } from './birth-form-state.ts'
import { luckAside, usedTimeText } from './chart-parts.tsx'
import {
  computeBaziChart,
  conceptHref,
  link,
  pageHref,
  ReadingSlots,
  ResultFooter,
  ResultStatus,
  usePrefetch,
} from './common.tsx'
import { loadBazi } from './engine.ts'
import {
  BRANCH_ELEMENT,
  BRANCH_HANZI,
  ELEMENT_TEXT,
  ganzhi,
  STEM_ELEMENT,
  STEM_HANZI,
} from './glyphs.ts'
import { PILLAR_LABEL, TEN_GOD_LABEL } from './labels.ts'
import { useBirthTool } from './use-birth-tool.ts'

const LOCALE = 'zh-Hant'
// 传统命盘表由右至左为年月日時，表格按阅读习惯列为時日月年（与常见万年历一致）
const ORDER: PillarKey[] = ['hour', 'day', 'month', 'year']

/** 繁中 `/zh-hant/命盤查詢`（tasks.md 2.3）：同一八字引擎，以表格呈现四柱与大运流年 */
export function MingpanPage() {
  const tool = useBirthTool({ locale: LOCALE, compute: computeBaziChart })
  usePrefetch(loadBazi)
  return (
    <ToolPage
      tool="mingpan"
      title={m.bazi_mingpan_title()}
      intro={<p className="m-0">{m.bazi_mingpan_intro()}</p>}
      form={
        <ToolForm
          key={tool.formKey}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
          <BirthFields values={tool.values} locale={LOCALE} issues={tool.issues} />
          <SubmitButton>{m.bazi_mingpan_submit()}</SubmitButton>
        </ToolForm>
      }
      result={
        tool.state.status === 'idle' || tool.state.status === 'invalid' ? null : (
          <ResultStatus state={tool.state}>
            {(chart) => (
              <MingpanResult chart={chart} share={toShareInput(tool.submitted ?? tool.values)} />
            )}
          </ResultStatus>
        )
      }
      links={[
        ...link(pageHref('home', LOCALE), m.bazi_link_home(), 'bazi'),
        ...link(pageHref('ziwei', LOCALE), m.bazi_link_ziwei(), 'ziwei'),
        ...link(conceptHref(LOCALE, 'ten-gods'), m.bazi_link_ten_gods(), 'concept-ten-gods'),
        ...link(conceptHref(LOCALE, 'luck'), m.bazi_link_luck(), 'concept-luck'),
      ]}
      faq={[
        { question: m.bazi_mingpan_faq_q1(), answer: m.bazi_mingpan_faq_a1() },
        { question: m.bazi_mingpan_faq_q2(), answer: m.bazi_mingpan_faq_a2() },
      ]}
    >
      <ReadingSlots
        tool="mingpan"
        optin={
          tool.state.status === 'done'
            ? {
                result: { kind: 'bazi', dayMaster: tool.state.result.dayMaster },
                share: toShareInput(tool.submitted ?? tool.values),
              }
            : null
        }
      />
    </ToolPage>
  )
}

const cell = 'border-line border-t px-1 py-2 text-center align-top'
const head = 'w-14 border-line border-t py-2 pr-1 text-left font-normal text-ink-subtle text-xs'

export function MingpanResult({
  chart,
  share,
}: {
  chart: BaziChart
  share: Readonly<Record<string, unknown>>
}) {
  const current = chart.currentYear.decadeIndex
  return (
    <>
      <ResultBlock
        id="pillars"
        index={1}
        title={m.bazi_mingpan_block_table()}
        aside={usedTimeText(chart, LOCALE)}
        description={m.bazi_mingpan_desc_table()}
      >
        <table id="ten-gods" className="w-full scroll-mt-6 border-collapse text-[15px]">
          <thead>
            <tr>
              <td className="w-14" />
              {ORDER.map((k) => (
                <th key={k} scope="col" className="pb-2 font-normal text-ink-subtle text-sm">
                  {PILLAR_LABEL[k]()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={head}>
                {m.bazi_ten_gods()}
              </th>
              {ORDER.map((k) => {
                const p = chart.pillars[k]
                return (
                  <td key={k} className={cn(cell, 'text-ink-muted text-sm')}>
                    {k === 'day'
                      ? m.bazi_day_master()
                      : p?.tenGod
                        ? TEN_GOD_LABEL[p.tenGod]()
                        : '—'}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row" className={head}>
                {m.bazi_stem_row()}
              </th>
              {ORDER.map((k) => {
                const p = chart.pillars[k]
                return (
                  <td
                    key={k}
                    className={cn(
                      cell,
                      'font-heading text-[28px]',
                      p && ELEMENT_TEXT[STEM_ELEMENT[p.stem]],
                    )}
                  >
                    {p ? (
                      STEM_HANZI[p.stem]
                    ) : (
                      <span className="text-ink-subtle text-xs">{m.bazi_requires_hour()}</span>
                    )}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row" className={head}>
                {m.bazi_branch_row()}
              </th>
              {ORDER.map((k) => {
                const p = chart.pillars[k]
                return (
                  <td
                    key={k}
                    className={cn(
                      cell,
                      'font-heading text-[28px]',
                      p && ELEMENT_TEXT[BRANCH_ELEMENT[p.branch]],
                    )}
                  >
                    {p ? BRANCH_HANZI[p.branch] : '—'}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row" className={head}>
                {m.bazi_hidden_stems()}
              </th>
              {ORDER.map((k) => (
                <td key={k} className={cell}>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                    {chart.pillars[k]?.hiddenStems.map((h) => (
                      <li key={h.qi}>
                        <span className="font-heading">{STEM_HANZI[h.stem]}</span>{' '}
                        <span className="text-ink-muted text-xs">{TEN_GOD_LABEL[h.tenGod]()}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </ResultBlock>
      <ResultBlock
        id="luck"
        index={2}
        title={m.bazi_mingpan_block_fortune()}
        aside={luckAside(chart, false)}
        description={m.bazi_mingpan_desc_fortune()}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-ink-subtle text-xs">
                <th scope="col" className="py-2 font-normal">
                  {m.bazi_mingpan_col_decade()}
                </th>
                <th scope="col" className="py-2 font-normal">
                  {m.bazi_mingpan_col_years()}
                </th>
                <th scope="col" className="py-2 font-normal">
                  {m.bazi_mingpan_col_age()}
                </th>
                <th scope="col" className="py-2 font-normal">
                  {m.bazi_mingpan_col_annual()}
                </th>
              </tr>
            </thead>
            <tbody>
              {chart.fortune.decades.map((d) => (
                <tr
                  key={d.index}
                  data-decade={d.index}
                  className={cn(
                    'border-line border-t align-top',
                    d.index === current && 'bg-brand/8',
                  )}
                >
                  <th scope="row" className="py-2 pr-2 text-left font-normal">
                    <span className="font-heading text-lg text-ink">
                      {ganzhi(d.stem, d.branch)}
                    </span>{' '}
                    <span className="text-ink-muted text-xs">{TEN_GOD_LABEL[d.tenGod]()}</span>
                  </th>
                  <td className="py-2 pr-2 text-ink-muted tabular-nums">
                    {d.startYear}–{d.endYear}
                  </td>
                  <td className="py-2 pr-2 text-ink-muted tabular-nums">
                    {d.startAge}–{d.endAge}
                  </td>
                  <td className="py-2 font-heading text-ink-muted">
                    {d.years.map((y) => ganzhi(y.stem, y.branch)).join(' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ResultBlock>
      <ResultFooter share={share} engineVersion={chart.engineVersion} />
    </>
  )
}
