import type { BaziChart } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { birthUnlock } from '../../readings/unlock-requests.ts'
import { Breadcrumb } from '../breadcrumb.tsx'
import { ElementsChart } from '../charts/elements-chart.tsx'
import { PillarsChart } from '../charts/pillars-chart.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { baziShareCard } from '../share-card/sources-bazi.ts'
import { paragraphs, ToolArticle } from '../tool-article.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { toShareInput } from './birth-form-state.ts'
import {
  ConceptLink,
  HiddenStemsTable,
  LuckAxis,
  luckAside,
  ShenshaChips,
  StrengthBody,
  UsefulBody,
  usedTimeText,
  WeightBody,
} from './chart-parts.tsx'
import { eastChineseLocale } from './chinese-locale.ts'
import {
  computeBaziChart,
  conceptHref,
  link,
  localPageHref,
  ReadingSlots,
  ResultFooter,
  ResultStatus,
  usePrefetch,
} from './common.tsx'
import { loadBazi } from './engine.ts'
import { useBirthTool } from './use-birth-tool.ts'

/** 结果区块下的小字说明只取长文的第一段（日语长文按空行分段；其他语言只有一段，输出不变） */
const lead = (text: string) => paragraphs(text)[0] ?? text

/** 结果区内的两栏：手机单列 */
const twoColumns = 'grid grid-cols-1 gap-6 md:grid-cols-2'

/**
 * 八字排盤工具页 `/zh-hant/八字排盤`、`/zh-hans/八字排盘`（openspec separate-landing-homepage design.md D1；
 * 设计稿 warm-refresh/ToolBazi.dc.html）：H1 + 简介 + 表单 → 结果 → 「八字命盤怎麼看」长文 → FAQ → 内链。
 * 七个结果区块依次为四柱、五行强弱、身強身弱、喜用神、大運十年轴、神煞、八字重量。
 */
export function BaziHome({ focusBlock }: { focusBlock?: string }) {
  const LOCALE = eastChineseLocale()
  const tool = useBirthTool({ locale: LOCALE, compute: computeBaziChart, focusBlock })
  usePrefetch(loadBazi)
  return (
    <ToolPage
      tool="bazi"
      breadcrumb={
        <Breadcrumb
          items={[
            { name: m.marketing_nav_home(), href: toolHref('/', LOCALE) },
            { name: m.bazi_link_home() },
          ]}
        />
      }
      title={m.bazi_home_title()}
      intro={<p className="m-0">{m.bazi_home_intro()}</p>}
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
          <SubmitButton>{m.bazi_submit()}</SubmitButton>
        </ToolForm>
      }
      result={
        tool.state.status === 'idle' || tool.state.status === 'invalid' ? null : (
          <ResultStatus state={tool.state}>
            {(chart) => (
              <BaziResult chart={chart} share={toShareInput(tool.submitted ?? tool.values)} />
            )}
          </ResultStatus>
        )
      }
      links={[
        ...link(localPageHref('ziwei', LOCALE), m.bazi_link_ziwei(), 'ziwei'),
        ...link(localPageHref('mingpan', LOCALE), m.bazi_link_mingpan(), 'mingpan'),
        ...link(conceptHref(LOCALE, 'luck'), m.bazi_link_luck(), 'concept-luck'),
        ...link(conceptHref(LOCALE, 'useful-god'), m.bazi_link_useful(), 'concept-useful-god'),
        ...link(conceptHref(LOCALE, 'strength'), m.bazi_link_strength(), 'concept-strength'),
        ...link(conceptHref(LOCALE, 'ten-gods'), m.bazi_link_ten_gods(), 'concept-ten-gods'),
      ]}
      article={
        <ToolArticle
          title={m.bazi_home_article_title()}
          sections={[
            { heading: m.bazi_block_pillars(), body: m.bazi_desc_pillars() },
            { heading: m.bazi_block_elements(), body: m.bazi_desc_elements() },
            { heading: m.bazi_block_strength(), body: m.bazi_desc_strength() },
            { heading: m.bazi_block_useful(), body: m.bazi_desc_useful() },
            { heading: m.bazi_block_luck(), body: m.bazi_desc_luck() },
            { heading: m.bazi_block_shensha(), body: m.bazi_desc_shensha() },
            { heading: m.bazi_block_weight(), body: m.bazi_desc_weight() },
          ]}
        />
      }
      faq={[
        { question: m.bazi_home_faq_q1(), answer: m.bazi_home_faq_a1() },
        { question: m.bazi_home_faq_q2(), answer: m.bazi_home_faq_a2() },
        { question: m.bazi_home_faq_q3(), answer: m.bazi_home_faq_a3() },
      ]}
    >
      <ReadingSlots
        tool="bazi"
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

export function BaziResult({
  chart,
  share,
}: {
  chart: BaziChart
  share: Readonly<Record<string, unknown>>
}) {
  // 图表按中文排列（东方站根路径英文同样按年月日时、干支用汉字）；概念页链接按页面语言取，
  // 英文没有概念页（5b 暂缓），conceptHref 返回 undefined，链接不渲染
  const LOCALE = eastChineseLocale()
  const conceptLocale = getLocale() === 'en' ? 'en' : LOCALE
  return (
    <>
      <ResultBlock
        id="pillars"
        index={1}
        title={m.bazi_block_pillars()}
        aside={usedTimeText(chart, LOCALE)}
        description={lead(m.bazi_desc_pillars())}
      >
        <PillarsChart pillars={chart.pillars} locale={LOCALE} />
        <HiddenStemsTable chart={chart} locale={LOCALE} />
      </ResultBlock>
      <div className={twoColumns}>
        <ResultBlock
          id="elements"
          index={2}
          title={m.bazi_block_elements()}
          description={lead(m.bazi_desc_elements())}
        >
          <ElementsChart elements={chart.strength.elements} />
        </ResultBlock>
        <div className="flex flex-col gap-6">
          <ResultBlock
            id="strength"
            index={3}
            title={m.bazi_block_strength()}
            description={lead(m.bazi_desc_strength())}
          >
            <StrengthBody chart={chart} />
          </ResultBlock>
          <ResultBlock
            id="useful-god"
            index={4}
            title={m.bazi_block_useful()}
            aside={m.bazi_useful_reference()}
            description={lead(m.bazi_desc_useful())}
          >
            <UsefulBody chart={chart} />
          </ResultBlock>
        </div>
      </div>
      <ResultBlock
        id="luck"
        index={5}
        title={m.bazi_block_luck()}
        aside={luckAside(chart)}
        description={lead(m.bazi_desc_luck())}
      >
        <LuckAxis
          chart={chart}
          locale={LOCALE}
          conceptHref={conceptHref(conceptLocale, 'luck', 'luck')}
        />
      </ResultBlock>
      <div className={twoColumns}>
        <ResultBlock
          id="shensha"
          index={6}
          title={m.bazi_block_shensha()}
          description={lead(m.bazi_desc_shensha())}
        >
          <ShenshaChips chart={chart} />
          {!chart.hourKnown && (
            <p className="m-0 text-caption text-ink-subtle">{m.bazi_shensha_hour_note()}</p>
          )}
          <div className="flex flex-wrap gap-x-5">
            <ConceptLink href={conceptHref(conceptLocale, 'void')}>
              {m.bazi_void_link()}
            </ConceptLink>
            <ConceptLink href={conceptHref(conceptLocale, 'shensha')}>
              {m.bazi_shensha_link()}
            </ConceptLink>
          </div>
        </ResultBlock>
        <ResultBlock
          id="weight"
          index={7}
          title={m.bazi_block_weight()}
          description={lead(m.bazi_desc_weight())}
        >
          <WeightBody chart={chart} />
          <ConceptLink href={conceptHref(conceptLocale, 'weight')}>
            {m.bazi_weight_link()}
          </ConceptLink>
        </ResultBlock>
      </div>
      <ResultFooter
        share={share}
        engineVersion={chart.engineVersion}
        card={() => baziShareCard(chart, 'bazi', LOCALE)}
      />
    </>
  )
}
