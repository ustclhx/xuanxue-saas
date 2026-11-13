import type { BirthInput } from '@xuanxue/bazi'
import type { PalaceKey, ZiweiChart } from '@xuanxue/bazi/ziwei'
import { cn } from '@xuanxue/ui'
import { m } from '../../../paraglide/messages.js'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { birthUnlock } from '../../readings/unlock-requests.ts'
import { ZiweiChartGraphic } from '../charts/ziwei-chart.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ziweiShareCard } from '../share-card/sources-ziwei.ts'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { toShareInput } from './birth-form-state.ts'
import { eastChineseLocale } from './chinese-locale.ts'
import { link, pageHref, ReadingSlots, ResultFooter, ResultStatus, usePrefetch } from './common.tsx'
import { loadZiwei } from './engine.ts'
import { BRANCH_HANZI, formatDateTime, STEM_HANZI } from './glyphs.ts'
import { useBirthTool } from './use-birth-tool.ts'
import { BRIGHTNESS_LABEL, label, MUTAGEN_LABEL, PALACE_LABEL, STAR_LABEL } from './ziwei-labels.ts'

async function computeZiweiChart(input: BirthInput): Promise<ZiweiChart> {
  return (await loadZiwei()).computeZiwei(input)
}

/** 繁中 `/zh-hant/紫微斗數排盤`（tasks.md 2.3）：与八字共用表单，只切换引擎 */
export function ZiweiPage() {
  const LOCALE = eastChineseLocale()
  const tool = useBirthTool({ locale: LOCALE, compute: computeZiweiChart })
  usePrefetch(loadZiwei)
  return (
    <ToolPage
      tool="ziwei"
      title={m.bazi_ziwei_title()}
      intro={<p className="m-0">{m.bazi_ziwei_intro()}</p>}
      form={
        <ToolForm
          key={tool.formKey}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
          <ProfileBar target={{ kind: 'birth', tool: 'ziwei', onFill: tool.fill }} />
          <BirthFields values={tool.values} locale={LOCALE} issues={tool.issues} />
          <SubmitButton>{m.bazi_ziwei_submit()}</SubmitButton>
        </ToolForm>
      }
      result={
        tool.state.status === 'idle' || tool.state.status === 'invalid' ? null : (
          <ResultStatus state={tool.state}>
            {(chart) => (
              <ZiweiResult chart={chart} share={toShareInput(tool.submitted ?? tool.values)} />
            )}
          </ResultStatus>
        )
      }
      links={[
        ...link(pageHref('home', LOCALE), m.bazi_link_home(), 'bazi'),
        ...link(pageHref('mingpan', LOCALE), m.bazi_link_mingpan(), 'mingpan'),
      ]}
      faq={[
        { question: m.bazi_ziwei_faq_q1(), answer: m.bazi_ziwei_faq_a1() },
        { question: m.bazi_ziwei_faq_q2(), answer: m.bazi_ziwei_faq_a2() },
      ]}
    >
      <ReadingSlots tool="ziwei">
        <ReadingUnlock
          kind="ziwei-full"
          request={
            tool.state.status === 'done' && tool.state.result.status === 'ok'
              ? birthUnlock(tool.submitted ?? tool.values)
              : null
          }
        />
      </ReadingSlots>
    </ToolPage>
  )
}

// 十二宫顺序取自文案表的键序；不从引擎模块取值，避免把紫微引擎打进页面首屏包
const PALACE_ORDER = Object.keys(PALACE_LABEL) as PalaceKey[]

/** 宫位列表（图形的等价文字内容，「紫微盘手机版」画布）：每宫的宫名、干支、命身宫标记与全部主星 */
function PalaceList({ chart }: { chart: Extract<ZiweiChart, { status: 'ok' }> }) {
  return (
    <section aria-labelledby="ziwei-palace-list" className="flex flex-col gap-2.5">
      <h3 id="ziwei-palace-list" className="m-0 font-semibold text-base text-ink">
        {m.chart_ziwei_list_title()}
      </h3>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {/* 列表从命宫起按十二宫顺序（命宮、兄弟、夫妻…），便于逐宫阅读 */}
        {[...chart.palaces]
          .sort((a, b) => PALACE_ORDER.indexOf(a.key) - PALACE_ORDER.indexOf(b.key))
          .map((palace) => {
            const isSoul = palace.branch === chart.soulPalaceBranch
            return (
              <li
                key={palace.key}
                data-palace-item={palace.key}
                className={cn(
                  'flex min-w-0 flex-col gap-1 rounded-lg bg-surface px-3.5 py-3',
                  isSoul ? 'border-2 border-brand' : 'border border-line',
                )}
              >
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-semibold text-ink">{PALACE_LABEL[palace.key]()}</span>
                  <span className="font-heading text-ink-subtle text-sm">
                    {STEM_HANZI[palace.stem]}
                    {BRANCH_HANZI[palace.branch]}
                  </span>
                  {isSoul && (
                    <span className="rounded-full bg-brand px-1.5 text-on-brand text-xs">
                      {m.bazi_ziwei_soul()}
                    </span>
                  )}
                  {palace.isBodyPalace && (
                    <span className="rounded-full bg-inverse px-1.5 text-on-inverse text-xs">
                      {m.bazi_ziwei_body()}
                    </span>
                  )}
                </span>
                <span className="text-ink-muted text-sm">
                  {palace.majorStars.length === 0
                    ? m.bazi_ziwei_empty()
                    : palace.majorStars.map((s, index) => (
                        <span key={s.star}>
                          {index > 0 && '、'}
                          <strong className="font-heading font-normal text-brand-ink">
                            {STAR_LABEL[s.star]()}
                          </strong>
                          {s.brightness && label(BRIGHTNESS_LABEL, s.brightness)}
                          {s.mutagen && ` ${MUTAGEN_LABEL[s.mutagen]()}`}
                        </span>
                      ))}
                </span>
              </li>
            )
          })}
      </ul>
    </section>
  )
}

export function ZiweiResult({
  chart,
  share,
}: {
  chart: ZiweiChart
  share: Readonly<Record<string, unknown>>
}) {
  if (chart.status === 'requiresHour')
    return (
      <p
        role="status"
        data-ziwei="requires-hour"
        className="m-0 rounded-xl border border-brand border-l-4 bg-surface p-5 text-ink leading-relaxed"
      >
        {m.bazi_ziwei_requires_hour()}
      </p>
    )
  const palaceOf = (key: PalaceKey) => chart.palaces.find((p) => p.key === key)
  return (
    <>
      <ResultBlock
        id="palaces"
        index={1}
        title={m.bazi_ziwei_block_palaces()}
        aside={formatDateTime(chart.used)}
        description={m.bazi_ziwei_desc_palaces()}
        className="p-3 sm:p-5"
      >
        <ZiweiChartGraphic chart={chart} />
        <PalaceList chart={chart} />
      </ResultBlock>
      <ResultBlock
        id="mutagens"
        index={2}
        title={m.bazi_ziwei_block_mutagens()}
        description={m.bazi_ziwei_desc_mutagens()}
      >
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2 p-0">
          {chart.mutagens.map((item) => {
            const palace = palaceOf(item.palace)
            return (
              <li
                key={item.mutagen}
                data-mutagen={item.mutagen}
                className="rounded-lg bg-surface-2 px-3 py-2.5 text-ink"
              >
                {m.bazi_ziwei_mutagen_row({
                  star: label(STAR_LABEL, item.star),
                  mutagen: MUTAGEN_LABEL[item.mutagen](),
                  palace: palace ? PALACE_LABEL[palace.key]() : item.palace,
                })}
              </li>
            )
          })}
        </ul>
      </ResultBlock>
      <ResultFooter
        share={share}
        engineVersion={chart.engineVersion}
        card={() => ziweiShareCard(chart)}
      />
    </>
  )
}
