import { m } from '../../../paraglide/messages.js'
import { RichContent } from '../../marketing/rich-content.tsx'
import { SubmitButton, ToolForm } from '../form.tsx'
import { ToolPage } from '../tool-page.tsx'
import { BaziResult } from './bazi-home.tsx'
import { BirthFields } from './birth-fields.tsx'
import { KO_TRUE_SOLAR_DEFAULT, toShareInput } from './birth-form-state.ts'
import { computeBaziChart, pageHref, ReadingSlots, ResultStatus } from './common.tsx'
import type { ConceptPageData } from './concepts.ts'
import { SajuResult } from './manseryeok-home.tsx'
import { useBirthTool } from './use-birth-tool.ts'

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
      links={[
        { href: pageHref('home', page.locale), title: m.bazi_home_title(), target: 'bazi' },
        ...page.links,
      ]}
    >
      <ReadingSlots tool={ko ? 'manseryeok' : 'bazi'} />
      <article
        lang={page.locale}
        aria-label={page.title}
        className="max-w-[720px] text-ink [&_h2]:font-heading [&_h3]:font-heading [&_a]:text-brand-ink"
      >
        <RichContent html={page.html} />
      </article>
    </ToolPage>
  )
}
