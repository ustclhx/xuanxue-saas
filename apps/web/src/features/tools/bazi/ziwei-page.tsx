import type { BirthInput, Branch } from '@xuanxue/bazi'
import type { MajorStar, Mutagen, PalaceKey, ZiweiChart, ZiweiPalace } from '@xuanxue/bazi/ziwei'
import { cn } from '@xuanxue/ui'
import { m } from '../../../paraglide/messages.js'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { toShareInput } from './birth-form-state.ts'
import { link, pageHref, ReadingSlots, ResultFooter, ResultStatus, usePrefetch } from './common.tsx'
import { loadZiwei } from './engine.ts'
import { BRANCH_HANZI, formatDateTime, STEM_HANZI } from './glyphs.ts'
import { useBirthTool } from './use-birth-tool.ts'

const LOCALE = 'zh-Hant'

type Message = () => string

const PALACE_LABEL: Record<PalaceKey, Message> = {
  soul: m.bazi_ziwei_palace_soul,
  siblings: m.bazi_ziwei_palace_siblings,
  spouse: m.bazi_ziwei_palace_spouse,
  children: m.bazi_ziwei_palace_children,
  wealth: m.bazi_ziwei_palace_wealth,
  health: m.bazi_ziwei_palace_health,
  surface: m.bazi_ziwei_palace_surface,
  friends: m.bazi_ziwei_palace_friends,
  career: m.bazi_ziwei_palace_career,
  property: m.bazi_ziwei_palace_property,
  spirit: m.bazi_ziwei_palace_spirit,
  parents: m.bazi_ziwei_palace_parents,
}

/** 十四主星与四化可能落到的辅星（文昌、文曲、左辅、右弼） */
const STAR_LABEL: Record<MajorStar | 'wenchang' | 'wenqu' | 'zuofu' | 'youbi', Message> = {
  ziwei: m.bazi_ziwei_star_ziwei,
  tianji: m.bazi_ziwei_star_tianji,
  taiyang: m.bazi_ziwei_star_taiyang,
  wuqu: m.bazi_ziwei_star_wuqu,
  tiantong: m.bazi_ziwei_star_tiantong,
  lianzhen: m.bazi_ziwei_star_lianzhen,
  tianfu: m.bazi_ziwei_star_tianfu,
  taiyin: m.bazi_ziwei_star_taiyin,
  tanlang: m.bazi_ziwei_star_tanlang,
  jumen: m.bazi_ziwei_star_jumen,
  tianxiang: m.bazi_ziwei_star_tianxiang,
  tianliang: m.bazi_ziwei_star_tianliang,
  qisha: m.bazi_ziwei_star_qisha,
  pojun: m.bazi_ziwei_star_pojun,
  wenchang: m.bazi_ziwei_star_wenchang,
  wenqu: m.bazi_ziwei_star_wenqu,
  zuofu: m.bazi_ziwei_star_zuofu,
  youbi: m.bazi_ziwei_star_youbi,
}

const BRIGHTNESS_LABEL: Record<string, Message> = {
  miao: m.bazi_ziwei_brightness_miao,
  wang: m.bazi_ziwei_brightness_wang,
  de: m.bazi_ziwei_brightness_de,
  li: m.bazi_ziwei_brightness_li,
  ping: m.bazi_ziwei_brightness_ping,
  bu: m.bazi_ziwei_brightness_bu,
  xian: m.bazi_ziwei_brightness_xian,
}

const MUTAGEN_LABEL: Record<Mutagen, Message> = {
  lu: m.bazi_ziwei_mutagen_lu,
  quan: m.bazi_ziwei_mutagen_quan,
  ke: m.bazi_ziwei_mutagen_ke,
  ji: m.bazi_ziwei_mutagen_ji,
}

const CLASS_LABEL: Record<string, Message> = {
  water2nd: m.bazi_ziwei_class_water2nd,
  wood3rd: m.bazi_ziwei_class_wood3rd,
  metal4th: m.bazi_ziwei_class_metal4th,
  earth5th: m.bazi_ziwei_class_earth5th,
  fire6th: m.bazi_ziwei_class_fire6th,
}

const label = (table: Record<string, Message>, key: string) => table[key]?.() ?? key

/** 传统命盘排法：地支宫位绕外圈固定（巳午未申在上、寅丑子亥在下），中间 2×2 为命盘信息 */
const GRID_AREA: Record<Branch, string> = {
  si: 'col-start-1 row-start-1',
  wu: 'col-start-2 row-start-1',
  wei: 'col-start-3 row-start-1',
  shen: 'col-start-4 row-start-1',
  chen: 'col-start-1 row-start-2',
  you: 'col-start-4 row-start-2',
  mao: 'col-start-1 row-start-3',
  xu: 'col-start-4 row-start-3',
  yin: 'col-start-1 row-start-4',
  chou: 'col-start-2 row-start-4',
  zi: 'col-start-3 row-start-4',
  hai: 'col-start-4 row-start-4',
}

async function computeZiweiChart(input: BirthInput): Promise<ZiweiChart> {
  return (await loadZiwei()).computeZiwei(input)
}

/** 繁中 `/zh-hant/紫微斗數排盤`（tasks.md 2.3）：与八字共用表单，只切换引擎 */
export function ZiweiPage() {
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
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
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
      <ReadingSlots tool="ziwei" />
    </ToolPage>
  )
}

function PalaceCell({ palace, isSoul }: { palace: ZiweiPalace; isSoul: boolean }) {
  return (
    <li
      data-palace={palace.key}
      className={cn(
        'flex min-h-28 min-w-0 flex-col gap-1 rounded-lg border p-1.5 sm:min-h-32 sm:p-2.5',
        GRID_AREA[palace.branch],
        isSoul ? 'border-2 border-brand bg-brand/8' : 'border-line bg-surface',
      )}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-1 text-xs sm:text-sm">
        <span className="font-heading text-ink">{PALACE_LABEL[palace.key]()}</span>
        <span className="text-ink-subtle">
          {STEM_HANZI[palace.stem]}
          {BRANCH_HANZI[palace.branch]}
        </span>
      </span>
      {(isSoul || palace.isBodyPalace) && (
        <span className="flex flex-wrap gap-1">
          {isSoul && (
            <span className="rounded-full bg-brand px-1.5 text-[11px] text-on-brand">
              {m.bazi_ziwei_soul()}
            </span>
          )}
          {palace.isBodyPalace && (
            <span className="rounded-full bg-inverse px-1.5 text-[11px] text-on-inverse">
              {m.bazi_ziwei_body()}
            </span>
          )}
        </span>
      )}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px] leading-snug sm:text-[15px]">
        {palace.majorStars.length === 0 && (
          <li className="text-ink-subtle text-xs">{m.bazi_ziwei_empty()}</li>
        )}
        {palace.majorStars.map((s) => (
          <li key={s.star} className="break-words text-ink">
            <span className="font-heading">{STAR_LABEL[s.star]()}</span>
            {s.brightness && (
              <span className="text-ink-subtle text-xs">
                {label(BRIGHTNESS_LABEL, s.brightness)}
              </span>
            )}
            {s.mutagen && (
              <span className="ml-0.5 inline-block whitespace-nowrap rounded bg-surface-2 px-1 text-brand-ink text-xs">
                {MUTAGEN_LABEL[s.mutagen]()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </li>
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
  const center = m.bazi_ziwei_center({
    class: label(CLASS_LABEL, chart.fiveElementsClass),
    soul: BRANCH_HANZI[chart.soulPalaceBranch],
    body: BRANCH_HANZI[chart.bodyPalaceBranch],
  })
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
        <ol className="m-0 grid list-none grid-cols-4 grid-rows-4 gap-1 p-0 sm:gap-2">
          {chart.palaces.map((palace) => (
            <PalaceCell
              key={palace.key}
              palace={palace}
              isSoul={palace.branch === chart.soulPalaceBranch}
            />
          ))}
          <li className="col-span-2 col-start-2 row-span-2 row-start-2 flex flex-col items-center justify-center gap-2 rounded-lg bg-surface-2 p-2 text-center">
            <span className="font-heading text-ink text-lg sm:text-2xl">
              {m.bazi_ziwei_title()}
            </span>
            <span className="text-ink-muted text-xs sm:text-sm">{center}</span>
          </li>
        </ol>
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
      <ResultFooter share={share} engineVersion={chart.engineVersion} />
    </>
  )
}
