import type { BaziChart, PillarKey } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { m } from '../../../paraglide/messages.js'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { birthUnlock } from '../../readings/unlock-requests.ts'
import { PillarsChart } from '../charts/pillars-chart.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { toShareInput } from './birth-form-state.ts'
import { luckAside, usedTimeText } from './chart-parts.tsx'
import { eastChineseLocale } from './chinese-locale.ts'
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
import { BRANCH_HANZI, ganzhi, STEM_HANZI } from './glyphs.ts'
import { PILLAR_LABEL, TEN_GOD_LABEL } from './labels.ts'
import { useBirthTool } from './use-birth-tool.ts'

// 传统命盘表由右至左为年月日時，表格按阅读习惯列为時日月年（与常见万年历一致）
const ORDER: PillarKey[] = ['hour', 'day', 'month', 'year']

/**
 * 繁中 `/zh-hant/命盤查詢`（tasks.md 2.3）：同一八字引擎，以表格呈现四柱与大运流年。
 * 版式套用工具页模板（设计稿 warm-refresh/ToolBazi.dc.html）：H1、简介、表单 → 结果 → FAQ → 内链。
 */
export function MingpanPage() {
  const LOCALE = eastChineseLocale()
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
          <ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill: tool.fill }} />
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
        ...link(pageHref('bazi', LOCALE), m.bazi_link_home(), 'bazi'),
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
      >
        <ReadingUnlock
          kind="bazi-full"
          request={tool.state.status === 'done' ? birthUnlock(tool.submitted ?? tool.values) : null}
        />
      </ReadingSlots>
    </ToolPage>
  )
}

const cell = 'border-line border-t px-1 py-2 text-center align-top'
/** 天干地支：title 字号的标题字体；五行已在上方的四柱图形中以色点和文字标出，这里不再用颜色区分 */
const glyph = 'font-heading text-ink text-title'
const head =
  'w-14 border-line border-t py-2 pr-1 text-left font-normal text-caption text-ink-subtle'

export function MingpanResult({
  chart,
  share,
}: {
  chart: BaziChart
  share: Readonly<Record<string, unknown>>
}) {
  const LOCALE = eastChineseLocale()
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
        <PillarsChart pillars={chart.pillars} locale={LOCALE} order={ORDER} />
        <table id="ten-gods" className="w-full scroll-mt-6 border-collapse text-body text-ink">
          <thead>
            <tr>
              <td className="w-14" />
              {ORDER.map((k) => (
                <th key={k} scope="col" className="pb-2 font-normal text-caption text-ink-subtle">
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
                  <td key={k} className={cn(cell, 'text-caption text-ink-muted')}>
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
                  <td key={k} className={cn(cell, glyph)}>
                    {p ? (
                      STEM_HANZI[p.stem]
                    ) : (
                      <span className="font-normal font-sans text-caption text-ink-subtle">
                        {m.bazi_requires_hour()}
                      </span>
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
                  <td key={k} className={cn(cell, glyph)}>
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
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {chart.pillars[k]?.hiddenStems.map((h) => (
                      <li key={h.qi}>
                        <span className="font-heading">{STEM_HANZI[h.stem]}</span>{' '}
                        <span className="text-caption text-ink-muted">
                          {TEN_GOD_LABEL[h.tenGod]()}
                        </span>
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
        {/* 手机上表格比容器宽，横向滚动：容器可用键盘聚焦并滚动（axe scrollable-region-focusable），以区块标题命名 */}
        <section
          aria-label={m.bazi_mingpan_block_fortune()}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: 可滚动区域需要键盘焦点才能用方向键滚动
          tabIndex={0}
          className="overflow-x-auto rounded-field focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <table className="w-full min-w-130 border-collapse text-body text-ink">
            <thead>
              <tr className="text-left text-caption text-ink-subtle">
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
                  aria-current={d.index === current ? 'true' : undefined}
                  className={cn(
                    'border-line border-t align-top',
                    // 目前所在的大运：整行换成 surface-2 底，干支旁加强调色圆点
                    d.index === current && 'bg-surface-2',
                  )}
                >
                  <th scope="row" className="px-2 py-2 text-left font-normal">
                    <span className="font-heading text-ink text-subtitle">
                      {ganzhi(d.stem, d.branch)}
                    </span>{' '}
                    <span className="text-caption text-ink-muted">{TEN_GOD_LABEL[d.tenGod]()}</span>
                    {d.index === current && (
                      <span
                        aria-hidden="true"
                        className="ml-1.5 inline-block size-2 rounded-full bg-mark align-middle"
                      />
                    )}
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
        </section>
      </ResultBlock>
      <ResultFooter share={share} engineVersion={chart.engineVersion} />
    </>
  )
}
