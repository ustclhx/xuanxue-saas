import type { BaziChart } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BirthFields } from './birth-fields.tsx'
import { KO_TRUE_SOLAR_DEFAULT, toShareInput } from './birth-form-state.ts'
import {
  ConceptLink,
  ElementStack,
  HiddenStemsTable,
  LuckAxis,
  luckAside,
  PillarsGrid,
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
 * 韩语 `/ko/` 만세력首页（tasks.md 3.1，原型 Manseryeok.dc.html）：六个结果区块依次为
 * 사주팔자、오행 분포、신강·신약、용신、대운·세운、신살·귀인·공망（最详细的一块，反色）。
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
      faq={[
        { question: m.bazi_home_faq_q1(), answer: m.bazi_home_faq_a1() },
        { question: m.bazi_home_faq_q2(), answer: m.bazi_home_faq_a2() },
        { question: m.bazi_home_faq_q3(), answer: m.bazi_home_faq_a3() },
      ]}
    >
      <ReadingSlots tool="manseryeok" />
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
        className="p-4 sm:p-5"
      >
        <PillarsGrid chart={chart} locale={LOCALE} />
        <p className="m-0 text-ink-subtle text-xs">{m.bazi_pillars_order_note()}</p>
        <HiddenStemsTable chart={chart} locale={LOCALE} />
      </ResultBlock>
      <ResultBlock
        id="elements"
        title={m.bazi_block_elements()}
        description={m.bazi_desc_elements()}
        className="p-4 sm:p-5"
      >
        <ElementStack chart={chart} />
      </ResultBlock>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-2.5 sm:gap-5">
        <ResultBlock
          id="strength"
          title={m.bazi_block_strength()}
          description={m.bazi_desc_strength()}
          className="p-3.5 sm:p-5"
        >
          <StrengthBody chart={chart} compact />
        </ResultBlock>
        <ResultBlock
          id="useful-god"
          title={m.bazi_block_useful()}
          aside={m.bazi_useful_reference()}
          description={m.bazi_desc_useful()}
          className="p-3.5 sm:p-5"
        >
          <UsefulBody chart={chart} />
        </ResultBlock>
      </div>
      <ResultBlock
        id="luck"
        title={m.bazi_block_luck()}
        aside={luckAside(chart)}
        description={m.bazi_desc_luck()}
        className="p-4 sm:p-5"
      >
        <LuckAxis chart={chart} locale={LOCALE} conceptHref={conceptHref(LOCALE, 'luck', 'luck')} />
      </ResultBlock>
      <ResultBlock
        id="shensha"
        title={m.bazi_block_shensha()}
        description={m.bazi_desc_shensha()}
        className="border-inverse bg-inverse p-4 text-on-inverse sm:p-5 [&_h2]:text-on-inverse [&_p]:text-on-inverse/80 [&_svg]:text-on-inverse/70"
      >
        <ShenshaTable chart={chart} />
        {!chart.hourKnown && <p className="m-0 text-sm">{m.bazi_shensha_hour_note()}</p>}
        <div className="flex flex-wrap gap-x-5 [&_a]:text-on-inverse [&_a]:underline">
          <ConceptLink href={conceptHref(LOCALE, 'shensha')}>{m.bazi_shensha_link()}</ConceptLink>
          <ConceptLink href={conceptHref(LOCALE, 'void')}>{m.bazi_void_link()}</ConceptLink>
        </div>
      </ResultBlock>
      <ResultFooter share={share} engineVersion={chart.engineVersion} />
    </>
  )
}
