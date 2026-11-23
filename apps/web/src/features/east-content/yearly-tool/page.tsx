import type {
  AnnualOutlook,
  AnnualRelation,
  BaziChart,
  BirthInput,
  Branch,
  Stem,
} from '@xuanxue/bazi'
import { FactTable } from '@xuanxue/ui/project'
import { m } from '../../../paraglide/messages.js'
import { EastEnArticle, eastEnFaq } from '../../east-en/article.tsx'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { birthUnlock } from '../../readings/unlock-requests.ts'
import { BirthFields } from '../../tools/bazi/birth-fields.tsx'
import { KO_TRUE_SOLAR_DEFAULT, toShareInput } from '../../tools/bazi/birth-form-state.ts'
import {
  computeBaziChart,
  conceptHref,
  link,
  localPageHref,
  ReadingSlots,
  ResultFooter,
  ResultStatus,
  usePrefetch,
} from '../../tools/bazi/common.tsx'
import { loadBazi } from '../../tools/bazi/engine.ts'
import {
  BRANCH_HANGUL,
  BRANCH_HANZI,
  ELEMENT_BG,
  STEM_HANGUL,
  STEM_HANZI,
} from '../../tools/bazi/glyphs.ts'
import { ELEMENT_LABEL, PILLAR_LABEL, TEN_GOD_LABEL } from '../../tools/bazi/labels.ts'
import { useBirthTool } from '../../tools/bazi/use-birth-tool.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { PillarsChart } from '../../tools/charts/pillars-chart.tsx'
import { SubmitButton, ToolForm } from '../../tools/form.tsx'
import { ResultBlock } from '../../tools/result-block.tsx'
import { ToolArticle } from '../../tools/tool-article.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import type { ToolLink } from '../../tools/tool-links.tsx'
import { ToolPage } from '../../tools/tool-page.tsx'
import { ZODIAC_HUB_PATHS, ZODIAC_HUB_TITLES } from '../zodiac/paths.ts'
import { fill, type YearlyToolCopy } from './copy/types.ts'
import { YEARLY_TOOL_YEAR, type YearlyToolLocale } from './paths.ts'

export interface YearlyToolResult {
  readonly chart: BaziChart
  readonly outlook: AnnualOutlook
}

/** 先排盘，再用同一个引擎 chunk 算 2027 一年的流年数据（design 决策 6） */
export async function computeYearly(input: BirthInput): Promise<YearlyToolResult> {
  const [chart, engine] = await Promise.all([computeBaziChart(input), loadBazi()])
  return { chart, outlook: engine.annualOutlook(chart, { startYear: YEARLY_TOOL_YEAR, years: 1 }) }
}

/** 干支字形：中文与英文用汉字，韩语在汉字后附한글读音（与만세력一致） */
function stemGlyph(stem: Stem, locale: YearlyToolLocale) {
  return locale === 'ko' ? `${STEM_HANZI[stem]}(${STEM_HANGUL[stem]})` : STEM_HANZI[stem]
}
function branchGlyph(branch: Branch, locale: YearlyToolLocale) {
  return locale === 'ko'
    ? `${BRANCH_HANZI[branch]}(${BRANCH_HANGUL[branch]})`
    : BRANCH_HANZI[branch]
}

/** 命盘图的排列：英文页同八字计算器，按繁中排列、干支用汉字 */
const chartLocale = (locale: YearlyToolLocale) => (locale === 'en' ? 'zh-Hant' : locale)

/** 正文内链（2–5 条，锚文本取术语表登记的写法；en 用第二种写法使 top1 ≤70%）：八字主工具、十神、大运与生肖枢纽 */
function relatedLinks(locale: YearlyToolLocale): ToolLink[] {
  if (locale === 'en')
    return [
      ...link(localPageHref('bazi', 'en'), 'Four Pillars of Destiny calculator', 'bazi'),
      ...link(localPageHref('ziwei', 'en'), 'Purple Star Astrology chart', 'ziwei'),
    ]
  const hub =
    locale === 'zh-Hans' || locale === 'ko'
      ? link(toolHref(ZODIAC_HUB_PATHS[locale], locale), ZODIAC_HUB_TITLES[locale], 'zodiac')
      : []
  return [
    ...link(localPageHref('bazi', locale), m.bazi_link_home(), 'bazi'),
    ...link(conceptHref(locale, 'ten-gods'), m.bazi_link_ten_gods(), 'concept-ten-gods'),
    ...link(conceptHref(locale, 'luck'), m.bazi_link_luck(), 'concept-luck'),
    ...hub,
  ]
}

/**
 * 个人 2027 流年工具页（设计稿 content-growth-v2-tools/Liunian2027.dc.html）：
 * H1 + 导语 + 八字表单（含出生档案）→ 结果（四柱、流年干支、十神、合冲、太岁与喜忌）→ 详批 → 说明长文 → FAQ → 内链。
 * 结果由引擎在浏览器计算，不改变地址；分享链接沿用 `#r=` 片段。
 */
export function YearlyToolPage({
  locale,
  copy,
}: {
  locale: YearlyToolLocale
  copy: YearlyToolCopy
}) {
  const tool = useBirthTool({
    locale,
    compute: computeYearly,
    ...(locale === 'ko' && { initial: { trueSolar: KO_TRUE_SOLAR_DEFAULT } }),
  })
  usePrefetch(loadBazi)
  const done = tool.state.status === 'done'
  return (
    <ToolPage
      tool="yearly-tool"
      breadcrumb={
        <Breadcrumb
          items={[
            { name: m.marketing_nav_home(), href: toolHref('/', locale) },
            { name: copy.crumb },
          ]}
        />
      }
      title={copy.h1}
      intro={<p className="m-0">{copy.intro}</p>}
      form={
        <ToolForm
          key={tool.formKey}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
          <ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill: tool.fill }} />
          <BirthFields
            values={tool.values}
            locale={locale}
            issues={tool.issues}
            trueSolarCallout={locale === 'ko'}
          />
          <SubmitButton>{copy.submit}</SubmitButton>
        </ToolForm>
      }
      result={
        tool.state.status === 'idle' || tool.state.status === 'invalid' ? null : (
          <ResultStatus state={tool.state}>
            {(result) => (
              <YearlyResult
                result={result}
                locale={locale}
                copy={copy}
                share={toShareInput(tool.submitted ?? tool.values)}
              />
            )}
          </ResultStatus>
        )
      }
      links={relatedLinks(locale)}
      linksTitle={copy.linksTitle}
      article={
        locale === 'en' ? (
          <EastEnArticle
            title={copy.article.title}
            sections={copy.article.sections.map((section) => ({
              heading: section.heading,
              paragraphs: section.body.split(/\n{2,}/),
            }))}
          />
        ) : (
          <ToolArticle title={copy.article.title} sections={copy.article.sections} />
        )
      }
      faq={
        locale === 'en'
          ? eastEnFaq(copy.faq.map((item) => ({ ...item, origin: 'adapted' as const })))
          : copy.faq.map((item) => ({ question: item.q, answer: item.a }))
      }
    >
      {/* 详批入口在免费结果之后（spec「详批入口」）：结果出现后才带请求，免费结果不被遮挡 */}
      <ReadingSlots tool="yearly-tool">
        {done && (
          <p data-testid="yearly-unlock-lead" className="m-0 max-w-180 text-body text-ink-muted">
            {copy.result.unlockLead}
          </p>
        )}
        <ReadingUnlock
          kind={locale === 'ko' ? 'saju-full' : 'bazi-full'}
          request={done ? birthUnlock(tool.submitted ?? tool.values) : null}
        />
      </ReadingSlots>
    </ToolPage>
  )
}

const twoColumns = 'grid grid-cols-1 gap-6 md:grid-cols-2'

function ElementDot({ element }: { element: keyof typeof ELEMENT_BG }) {
  return (
    <i aria-hidden="true" className={`inline-block size-2 rounded-full ${ELEMENT_BG[element]}`} />
  )
}

/** 关系对象的名称：本命某柱加地支，或大运加干支 */
function relationRows(
  outlook: AnnualOutlook['years'][number],
  chart: BaziChart,
  locale: YearlyToolLocale,
  copy: YearlyToolCopy,
) {
  const keys = (['year', 'month', 'day', 'hour'] as const).filter((key) => chart.pillars[key])
  const describe = (relations: readonly AnnualRelation[]) =>
    relations.length === 0
      ? copy.result.relNone
      : relations
          .map((relation) => copy.result.relTypes[relation.type])
          .join(copy.result.relSeparator)
  const rows: { key: string; label: string; value: string }[] = keys.map((key) => {
    const pillar = chart.pillars[key]
    return {
      key,
      label: `${PILLAR_LABEL[key]()} ${pillar ? `${stemGlyph(pillar.stem, locale)}${branchGlyph(pillar.branch, locale)}` : ''}`,
      value: describe(outlook.relations.filter((relation) => relation.with === key)),
    }
  })
  const decade = outlook.decade
  rows.push({
    key: 'decade',
    label: decade
      ? fill(copy.result.decadeValue, {
          gz: `${stemGlyph(decade.stem, locale)}${branchGlyph(decade.branch, locale)}`,
        })
      : copy.result.decadeLabel,
    value: decade
      ? [
          describe(outlook.relations.filter((relation) => relation.with === 'decade')),
          ...(outlook.decadeStart ? [copy.result.decadeStart] : []),
        ].join(locale === 'en' || locale === 'ko' ? '. ' : '；')
      : copy.result.noDecade,
  })
  return rows
}

export function YearlyResult({
  result,
  locale,
  copy,
  share,
}: {
  result: YearlyToolResult
  locale: YearlyToolLocale
  copy: YearlyToolCopy
  share: Readonly<Record<string, unknown>>
}) {
  const { chart, outlook } = result
  const year = outlook.years[0]
  if (!year) return null
  const text = copy.result
  const zh = locale === 'zh-Hans' || locale === 'zh-Hant'
  const role = (value: 'favorable' | 'unfavorable') =>
    value === 'favorable' ? text.favorable : text.unfavorable
  const dm = stemGlyph(chart.dayMaster, locale)
  const main = year.branchTenGods.find((item) => item.qi === 'main')
  const others = year.branchTenGods.filter((item) => item.qi !== 'main')
  const tenGodRows = [
    {
      key: 'stem',
      label: fill(text.stemRow, { gz: stemGlyph(year.stem, locale) }),
      tenGod: TEN_GOD_LABEL[year.stemTenGod](),
      element: year.elements.stem,
      role: role(year.favorable.stem),
    },
    {
      key: 'branch',
      label: fill(text.branchRow, { gz: branchGlyph(year.branch, locale) }),
      tenGod: main ? TEN_GOD_LABEL[main.tenGod]() : '',
      element: year.elements.branch,
      role: role(year.favorable.branch),
    },
  ]
  const natalYear = chart.pillars.year.branch
  const taiSui = fill(
    year.taiSui === 'zhi'
      ? text.taiSuiZhi
      : year.taiSui === 'chong'
        ? text.taiSuiChong
        : text.taiSuiNone,
    { branch: branchGlyph(year.branch, locale), natal: branchGlyph(natalYear, locale) },
  )
  // 中文直接连写「丁火」「未土」，韩、英文以空格分隔
  const gap = zh ? '' : ' '
  const favor = fill(text.favorText, {
    stemEl: `${stemGlyph(year.stem, locale)}${gap}${ELEMENT_LABEL[year.elements.stem]()}`,
    stemRole: role(year.favorable.stem),
    branchEl: `${branchGlyph(year.branch, locale)}${gap}${ELEMENT_LABEL[year.elements.branch]()}`,
    branchRole: role(year.favorable.branch),
  })
  return (
    <>
      {outlook.approximate && (
        <p
          role="note"
          data-testid="yearly-approximate"
          className="m-0 rounded-object bg-surface-2 px-5 py-4 text-body text-ink"
        >
          {text.approximate}
        </p>
      )}
      <div className={twoColumns}>
        <ResultBlock id="pillars" index={1} title={text.natalTitle}>
          <PillarsChart pillars={chart.pillars} locale={chartLocale(locale)} />
        </ResultBlock>
        <ResultBlock id="annual" index={2} title={text.yearTitle} aside={text.yearSpan}>
          <div className="flex items-start gap-8" data-testid="yearly-ganzhi">
            {[
              {
                glyph: stemGlyph(year.stem, locale),
                element: year.elements.stem,
                god: year.stemTenGod,
              },
              {
                glyph: branchGlyph(year.branch, locale),
                element: year.elements.branch,
                god: main?.tenGod ?? year.stemTenGod,
              },
            ].map((item) => (
              <div key={item.glyph} className="flex flex-col gap-1">
                <span className="font-bold font-heading text-display text-ink">{item.glyph}</span>
                <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
                  <ElementDot element={item.element} />
                  {ELEMENT_LABEL[item.element]()} · {TEN_GOD_LABEL[item.god]()}
                </span>
              </div>
            ))}
          </div>
        </ResultBlock>
      </div>
      <ResultBlock
        id="ten-gods"
        index={3}
        title={text.tenGodTitle}
        description={fill(text.tenGodLead, { dm })}
      >
        <FactTable
          caption={text.tenGodTitle}
          narrow
          stack
          rows={tenGodRows}
          rowKey={(row) => row.key}
          columns={[
            { key: 'label', header: text.tenGodCols[0], cell: (row) => row.label, kind: 'key' },
            { key: 'god', header: text.tenGodCols[1], cell: (row) => row.tenGod, stacked: 'label' },
            {
              key: 'element',
              header: text.tenGodCols[2],
              stacked: 'label',
              cell: (row) => (
                <span className="inline-flex items-center gap-1.5">
                  <ElementDot element={row.element} />
                  {ELEMENT_LABEL[row.element]()}
                </span>
              ),
            },
            { key: 'role', header: text.tenGodCols[3], cell: (row) => row.role, stacked: 'label' },
          ]}
        />
        {others.length > 0 && (
          <p className="m-0 text-caption text-ink-subtle">
            {fill(text.hiddenNote, {
              list: others
                .map((item) =>
                  zh
                    ? `${stemGlyph(item.stem, locale)}（${TEN_GOD_LABEL[item.tenGod]()}）`
                    : `${stemGlyph(item.stem, locale)} (${TEN_GOD_LABEL[item.tenGod]()})`,
                )
                .join(text.relSeparator),
            })}
          </p>
        )}
      </ResultBlock>
      <ResultBlock id="relations" index={4} title={text.relTitle} description={text.relLead}>
        <FactTable
          caption={text.relTitle}
          narrow
          stack
          rows={relationRows(year, chart, locale, copy)}
          rowKey={(row) => row.key}
          columns={[
            { key: 'label', header: text.relCols[0], cell: (row) => row.label, kind: 'key' },
            { key: 'value', header: text.relCols[1], cell: (row) => row.value, stacked: 'full' },
          ]}
        />
        <p className="m-0 text-caption text-ink-subtle">{text.ruleNote}</p>
      </ResultBlock>
      <div className={twoColumns}>
        <ResultBlock id="tai-sui" index={5} title={text.taiSuiTitle}>
          <p className="m-0 text-body text-ink-muted" data-testid="yearly-tai-sui">
            {taiSui}
          </p>
        </ResultBlock>
        <ResultBlock
          id="favorable"
          index={6}
          title={text.favorTitle}
          aside={m.bazi_useful_reference()}
        >
          <p className="m-0 text-body text-ink-muted">{favor}</p>
        </ResultBlock>
      </div>
      <ResultFooter share={share} engineVersion={chart.engineVersion} />
    </>
  )
}
