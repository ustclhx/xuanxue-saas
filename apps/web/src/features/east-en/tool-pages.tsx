import type { BirthInput } from '@xuanxue/bazi'
import type { ZiweiChart } from '@xuanxue/bazi/ziwei'
import { m } from '../../paraglide/messages.js'
import { ProfileBar } from '../profiles/profile-bar.tsx'
import { ReadingUnlock } from '../readings/unlock-card.tsx'
import { birthUnlock } from '../readings/unlock-requests.ts'
import { BaziResult } from '../tools/bazi/bazi-home.tsx'
import { BirthFields } from '../tools/bazi/birth-fields.tsx'
import { toShareInput } from '../tools/bazi/birth-form-state.ts'
import { computeBaziChart, ReadingSlots, ResultStatus, usePrefetch } from '../tools/bazi/common.tsx'
import { loadBazi, loadZiwei } from '../tools/bazi/engine.ts'
import { useBirthTool } from '../tools/bazi/use-birth-tool.ts'
import { ZiweiResult } from '../tools/bazi/ziwei-page.tsx'
import { Breadcrumb } from '../tools/breadcrumb.tsx'
import { SubmitButton, ToolForm } from '../tools/form.tsx'
import { ToolPage } from '../tools/tool-page.tsx'
import { EastEnArticle, eastEnFaq, HOME_CRUMB } from './article.tsx'
import { BAZI, ZIWEI } from './copy/tools.ts'
import type { ToolCopy } from './copy/types.ts'

async function computeZiweiChart(input: BirthInput): Promise<ZiweiChart> {
  return (await loadZiwei()).computeZiwei(input)
}

function crumbs(copy: ToolCopy) {
  return <Breadcrumb items={[HOME_CRUMB, { name: copy.nav }]} />
}

/**
 * 东方站根路径英文的八字计算器 `/bazi-calculator`（openspec add-locales-eu-ja 5b）：表单与结果复用八字排盤
 * 的组件（界面词为 Paraglide `messages/en/bazi.json`，命盘按中文排列、干支用汉字），正文、FAQ 与链接取
 * 东方站英文文案（copy/tools.ts），不复用中文页的长文结构。概念页在英文暂缓，结果中不出现概念页链接。
 */
export function EastEnBaziPage() {
  const tool = useBirthTool({ locale: 'en', compute: computeBaziChart })
  usePrefetch(loadBazi)
  return (
    <ToolPage
      tool="bazi"
      breadcrumb={crumbs(BAZI)}
      title={BAZI.h1}
      intro={<p className="m-0">{BAZI.intro}</p>}
      form={
        <ToolForm
          key={tool.formKey}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
          <ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill: tool.fill }} />
          <BirthFields values={tool.values} locale="en" issues={tool.issues} />
          <SubmitButton>{BAZI.submit}</SubmitButton>
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
      article={<EastEnArticle title={BAZI.articleTitle} sections={BAZI.sections} />}
      faq={eastEnFaq(BAZI.faq)}
    >
      <ReadingSlots tool="bazi">
        <ReadingUnlock
          kind="bazi-full"
          request={tool.state.status === 'done' ? birthUnlock(tool.submitted ?? tool.values) : null}
        />
      </ReadingSlots>
    </ToolPage>
  )
}

/** 东方站根路径英文的紫微斗数 `/zi-wei-dou-shu`：与八字计算器共用表单（同一出生信息存储），只切换引擎 */
export function EastEnZiweiPage() {
  const tool = useBirthTool({ locale: 'en', compute: computeZiweiChart })
  usePrefetch(loadZiwei)
  return (
    <ToolPage
      tool="ziwei"
      breadcrumb={crumbs(ZIWEI)}
      title={ZIWEI.h1}
      intro={<p className="m-0">{ZIWEI.intro}</p>}
      form={
        <ToolForm
          key={tool.formKey}
          label={m.bazi_form_label()}
          requiresJs={m.bazi_requires_js()}
          onSubmit={tool.onSubmit}
          onChange={tool.onChange}
        >
          <ProfileBar target={{ kind: 'birth', tool: 'ziwei', onFill: tool.fill }} />
          <BirthFields values={tool.values} locale="en" issues={tool.issues} />
          <SubmitButton>{ZIWEI.submit}</SubmitButton>
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
      article={<EastEnArticle title={ZIWEI.articleTitle} sections={ZIWEI.sections} />}
      faq={eastEnFaq(ZIWEI.faq)}
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
