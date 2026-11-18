import type { BaziChart } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { ProfileBar } from '../../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../../readings/unlock-card.tsx'
import { birthUnlock } from '../../readings/unlock-requests.ts'
import { Breadcrumb } from '../breadcrumb.tsx'
import { ElementsChart } from '../charts/elements-chart.tsx'
import { PillarsChart } from '../charts/pillars-chart.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { baziShareCard } from '../share-card/sources-bazi.ts'
import { ToolArticle } from '../tool-article.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { KO_TRUE_SOLAR_DEFAULT, toShareInput } from './birth-form-state.ts'
import {
  ConceptLink,
  HiddenStemsTable,
  LuckAxis,
  luckAside,
  ShenshaTable,
  StrengthBody,
  UsefulBody,
  usedTimeText,
} from './chart-parts.tsx'
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
import { useBirthTool } from './use-birth-tool.ts'

const LOCALE = 'ko'

/**
 * 만세력工具页 `/ko/만세력`（openspec separate-landing-homepage design.md D1；套用设计稿
 * warm-refresh/ToolBazi.dc.html 的版式）：H1 + 简介 + 表单 → 结果 → 说明长文 → FAQ → 内链。
 * 六个结果区块依次为 사주팔자、오행 분포、신강·신약、용신、대운·세운、신살·귀인·공망（最详细的一块，反色）。
 * 默认出生地首尔；手机优先。
 */
export function ManseryeokHome({ focusBlock }: { focusBlock?: string }) {
  const tool = useBirthTool({
    locale: LOCALE,
    compute: computeBaziChart,
    focusBlock,
    initial: { trueSolar: KO_TRUE_SOLAR_DEFAULT },
  })
  usePrefetch(loadBazi)
  return (
    <ToolPage
      tool="manseryeok"
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
          <BirthFields values={tool.values} locale={LOCALE} issues={tool.issues} trueSolarCallout />
          <SubmitButton>{m.bazi_submit()}</SubmitButton>
        </ToolForm>
      }
      result={
        tool.state.status === 'idle' || tool.state.status === 'invalid' ? null : (
          <ResultStatus state={tool.state}>
            {(chart) => (
              <SajuResult chart={chart} share={toShareInput(tool.submitted ?? tool.values)} />
            )}
          </ResultStatus>
        )
      }
      links={[
        ...link(pageHref('gunghap', LOCALE), m.bazi_link_gunghap(), 'gunghap'),
        ...link(conceptHref(LOCALE, 'shensha'), m.bazi_link_shensha(), 'concept-shensha'),
        ...link(conceptHref(LOCALE, 'void'), m.bazi_link_void(), 'concept-void'),
        ...link(conceptHref(LOCALE, 'luck'), m.bazi_link_luck(), 'concept-luck'),
        ...link(conceptHref(LOCALE, 'useful-god'), m.bazi_link_useful(), 'concept-useful-god'),
        ...link(conceptHref(LOCALE, 'strength'), m.bazi_link_strength(), 'concept-strength'),
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
        tool="manseryeok"
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
          kind="saju-full"
          request={tool.state.status === 'done' ? birthUnlock(tool.submitted ?? tool.values) : null}
        />
      </ReadingSlots>
    </ToolPage>
  )
}

export function SajuResult({
  chart,
  share,
}: {
  chart: BaziChart
  share: Readonly<Record<string, unknown>>
}) {
  return (
    <>
      <ResultBlock
        id="pillars"
        title={m.bazi_block_pillars()}
        aside={usedTimeText(chart, LOCALE)}
        description={m.bazi_desc_pillars()}
      >
        <PillarsChart pillars={chart.pillars} locale={LOCALE} />
        <p className="m-0 text-caption text-ink-subtle">{m.bazi_pillars_order_note()}</p>
        <HiddenStemsTable chart={chart} locale={LOCALE} />
      </ResultBlock>
      <ResultBlock
        id="elements"
        title={m.bazi_block_elements()}
        description={m.bazi_desc_elements()}
      >
        <ElementsChart elements={chart.strength.elements} />
      </ResultBlock>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ResultBlock
          id="strength"
          title={m.bazi_block_strength()}
          description={m.bazi_desc_strength()}
        >
          <StrengthBody chart={chart} compact />
        </ResultBlock>
        <ResultBlock
          id="useful-god"
          title={m.bazi_block_useful()}
          aside={m.bazi_useful_reference()}
          description={m.bazi_desc_useful()}
        >
          <UsefulBody chart={chart} />
        </ResultBlock>
      </div>
      <ResultBlock
        id="luck"
        title={m.bazi_block_luck()}
        aside={luckAside(chart)}
        description={m.bazi_desc_luck()}
      >
        <LuckAxis chart={chart} locale={LOCALE} conceptHref={conceptHref(LOCALE, 'luck', 'luck')} />
      </ResultBlock>
      <ResultBlock
        id="shensha"
        title={m.bazi_block_shensha()}
        description={m.bazi_desc_shensha()}
        className="bg-inverse text-on-inverse [&_h2]:text-on-inverse [&_p]:text-on-inverse/80 [&_svg]:text-on-inverse/70"
      >
        <ShenshaTable chart={chart} />
        {!chart.hourKnown && <p className="m-0 text-caption">{m.bazi_shensha_hour_note()}</p>}
        <div className="flex flex-wrap gap-x-5 [&_a]:text-on-inverse [&_a]:underline">
          <ConceptLink href={conceptHref(LOCALE, 'shensha')}>{m.bazi_shensha_link()}</ConceptLink>
          <ConceptLink href={conceptHref(LOCALE, 'void')}>{m.bazi_void_link()}</ConceptLink>
        </div>
      </ResultBlock>
      <ResultFooter
        share={share}
        engineVersion={chart.engineVersion}
        card={() => baziShareCard(chart, 'manseryeok', LOCALE)}
      />
    </>
  )
}
