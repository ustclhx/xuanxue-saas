import { m } from '../../../paraglide/messages.js'
import { RichContent } from '../../marketing/rich-content.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ContentFunnel } from '../reading-guide.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BaziResult } from './bazi-home.tsx'
import { BirthFields } from './birth-fields.tsx'
import { KO_TRUE_SOLAR_DEFAULT, toShareInput } from './birth-form-state.ts'
import { computeBaziChart, pageHref, ReadingSlots, ResultStatus } from './common.tsx'
import type { ConceptPageData } from './concepts.ts'
import { SajuResult } from './manseryeok-home.tsx'
import { useBirthTool } from './use-birth-tool.ts'

/**
 * 概念长文的排版（设计稿 warm-refresh/ToolBazi.dc.html 的 `.article`）：小节标题用 heading 角色、正文为弱化文字色，
 * 表格用 caption；覆盖 RichContent 默认的原始字号，页面只出现六个字号角色。
 */
const conceptProse =
  'text-body text-ink-muted [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-subtitle [&_h3]:font-bold [&_h3]:font-heading [&_h3]:text-body [&_h3]:text-ink [&_strong]:text-ink [&_a]:text-brand-ink [&_table]:text-caption [&_code]:text-caption'

/**
 * 八字 / 사주概念页（`/八字/<slug>`、`/사주/<slug>`）：套用工具页模板，H1、简介、表单 → 结果 → 概念长文 → FAQ → 内链。
 */
export function ConceptPage({ page }: { page: ConceptPageData }) {
  const ko = page.locale === 'ko'
  const tool = useBirthTool({
    locale: page.locale,
    compute: computeBaziChart,
    focusBlock: page.block,
    focusItem: page.conceptKey === 'void' ? 'void' : page.block,
    initial: ko ? { trueSolar: KO_TRUE_SOLAR_DEFAULT } : {},
  })
  const Result = ko ? SajuResult : BaziResult
  // 主工具页：韩语是만세력（saju-full），中文是八字排盤（bazi-full）；不链接语言首页（落地页）
  const home = pageHref('bazi', page.locale)
  return (
    <ToolPage
      tool={`bazi-concept-${page.conceptKey}`}
      title={page.title}
      intro={<p className="m-0">{page.description}</p>}
      form={
        <ToolForm
          key={tool.formKey}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
          <BirthFields
            values={tool.values}
            locale={page.locale}
            issues={tool.issues}
            trueSolarCallout={ko}
          />
          <SubmitButton>{m.bazi_submit()}</SubmitButton>
        </ToolForm>
      }
      result={
        tool.state.status === 'idle' || tool.state.status === 'invalid' ? null : (
          <ResultStatus state={tool.state}>
            {(chart) => (
              <Result chart={chart} share={toShareInput(tool.submitted ?? tool.values)} />
            )}
          </ResultStatus>
        )
      }
      faq={page.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      links={[{ href: home, title: m.bazi_home_title(), target: 'bazi' }, ...page.links]}
    >
      <ReadingSlots
        tool={ko ? 'manseryeok' : 'bazi'}
        optin={
          tool.state.status === 'done'
            ? {
                result: { kind: 'bazi', dayMaster: tool.state.result.dayMaster },
                share: toShareInput(tool.submitted ?? tool.values),
              }
            : null
        }
      />
      {/* 概念长文在表单与结果之后（tool-pages「工具页紧凑布局」）；限宽 720px，标题与正文只用字号角色 */}
      <article lang={page.locale} aria-label={page.title} className="max-w-180">
        <RichContent html={page.html} className={conceptProse} />
      </article>
      <ContentFunnel
        tool={{
          href: home,
          label: m.funnel_content_bazi_tool(),
          target: ko ? 'manseryeok' : 'bazi',
        }}
        reading={{
          kind: ko ? 'saju-full' : 'bazi-full',
          href: home,
          label: m.funnel_content_reading(),
          target: ko ? 'reading-saju-full' : 'reading-bazi-full',
        }}
      />
    </ToolPage>
  )
}
