import { createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import {
  CheckboxField,
  ChoiceGroup,
  SelectField,
  SubmitButton,
  TextField,
  ToolForm,
} from '../../features/tools/form.tsx'
import { ResultBlock } from '../../features/tools/result-block.tsx'
import { readShareFragment } from '../../features/tools/share.ts'
import { ShareLink } from '../../features/tools/share-link.tsx'
import { ToolPage } from '../../features/tools/tool-page.tsx'

// 工具页外壳的组件演示（openspec add-dual-site-foundation tasks.md 4.2），只在本地开发服务器可用。
// 东方站样式：`http://east.localhost:<WEB_PORT>/zh-hant/dev/tools`；西方站：`/dev/tools`。
// 演示文案不进入 messages，结果为固定样例，不代表任何排盘引擎。
export const Route = createFileRoute('/dev/tools')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({
    meta: [{ title: 'Tool shell demo' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ToolsDemoPage,
})

type DemoInput = Record<'calendar' | 'sex' | 'year' | 'month' | 'day' | 'time', string>

function ToolsDemoPage() {
  const [input, setInput] = useState<DemoInput | null>(null)
  // 打开分享链接（#r=）时直接复现结果
  useEffect(() => {
    const shared = readShareFragment(window.location.hash)
    if (shared)
      setInput({
        calendar: String(shared.calendar ?? ''),
        sex: String(shared.sex ?? ''),
        year: String(shared.year ?? ''),
        month: String(shared.month ?? ''),
        day: String(shared.day ?? ''),
        time: String(shared.time ?? ''),
      })
  }, [])
  const submit = (data: FormData) => {
    const value = (key: string) => String(data.get(key) ?? '')
    setInput({
      calendar: value('calendar'),
      sex: value('sex'),
      year: value('year'),
      month: value('month'),
      day: value('day'),
      time: value('time'),
    })
  }
  return (
    <MarketingShell>
      <ToolPage
        tool="demo"
        title="Tool shell demo"
        intro={
          <p className="m-0">
            Inline form, result blocks, share link, disclaimer, related links and FAQ. The result is
            a fixed sample computed in the browser.
          </p>
        }
        form={
          <ToolForm label="Birth details" onSubmit={submit}>
            <ChoiceGroup
              legend="Calendar"
              name="calendar"
              options={[
                { value: 'solar', label: 'Solar' },
                { value: 'lunar', label: 'Lunar' },
              ]}
            />
            <ChoiceGroup
              legend="Sex"
              name="sex"
              options={[
                { value: 'm', label: 'Male' },
                { value: 'f', label: 'Female' },
              ]}
            />
            <TextField label="Birth year" name="year" inputMode="numeric" defaultValue="1990" />
            <TextField label="Month" name="month" inputMode="numeric" defaultValue="5" />
            <TextField label="Day" name="day" inputMode="numeric" defaultValue="15" />
            <TextField label="Time" name="time" type="time" defaultValue="10:30" />
            <CheckboxField label="I don't know the birth hour" name="unknownTime" />
            <SelectField
              label="Birthplace"
              name="place"
              options={[
                { value: 'taipei', label: 'Taipei' },
                { value: 'seoul', label: 'Seoul' },
              ]}
            />
            <SubmitButton>Calculate</SubmitButton>
          </ToolForm>
        }
        result={
          input && (
            <>
              <ResultBlock
                id="pillars"
                index={1}
                title="Four pillars"
                aside={`${input.year}-${input.month}-${input.day} ${input.time}`}
                description="Each pillar pairs a heavenly stem with an earthly branch."
              >
                <div className="grid grid-cols-4 gap-3 text-center font-heading text-[44px] leading-tight">
                  <span className="text-wx-metal">庚</span>
                  <span className="text-wx-metal">辛</span>
                  <span className="text-wx-metal">庚</span>
                  <span className="text-wx-metal">辛</span>
                </div>
              </ResultBlock>
              <ResultBlock
                id="elements"
                index={2}
                title="Five elements"
                description="Counted from the main qi of each stem and branch."
              >
                <p className="m-0 text-ink">Metal 4 · Fire 3 · Earth 1 · Wood 0 · Water 0</p>
              </ResultBlock>
              <ShareLink input={input} />
            </>
          )
        }
        links={[
          { href: '#pillars', title: 'How to read the pillars', target: 'pillars-guide' },
          { href: '#elements', title: 'What the five elements mean', target: 'elements-guide' },
        ]}
        faq={[
          {
            question: 'Is my birth data sent to a server?',
            answer: 'No. It stays in your browser.',
          },
          { question: 'Do I need an account?', answer: 'No. The free result needs no sign-up.' },
        ]}
      />
    </MarketingShell>
  )
}
