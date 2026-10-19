import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { Markdown } from '../../features/readings/markdown.tsx'
import type { ReadingOffer } from '../../features/readings/readings.functions.ts'
import { ReadingUnlock } from '../../features/readings/unlock-card.tsx'
import { Disclaimer } from '../../features/tools/disclaimer.tsx'

// 解锁卡与报告排版的本地演示（add-reading-monetization tasks.md 3.1–3.2 截图对照），只在开发服务器可用。
// 东方站：`/zh-hant/dev/readings?kind=bazi-full`、`/ko/dev/readings?kind=saju-full`；西方站：`/dev/readings`。
// 报价与报告为固定样例，不读取数据库；`?signed=1` 模拟已登录、`?balance=0` 模拟积分不足。
export const Route = createFileRoute('/dev/readings')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  validateSearch: (search: Record<string, unknown>) => ({
    kind: typeof search.kind === 'string' ? search.kind : 'numerology-full',
    signed: search.signed === 1 || search.signed === '1',
    balance: Number(search.balance ?? 300),
  }),
  head: () => ({
    meta: [{ title: 'Readings demo' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ReadingsDemoPage,
})

const SECTIONS: Record<string, string[]> = {
  'bazi-full': ['總論', '性格', '事業', '財運', '感情', '健康作息提示', '未來十年大運', '建議'],
  'saju-full': [
    '총론',
    '성격',
    '직업운',
    '재물운',
    '애정운',
    '건강·생활 습관',
    '향후 10년 대운',
    '조언',
  ],
  'numerology-full': [
    'Overview',
    'Life Path',
    'Core Numbers',
    'Personal Year',
    'Love and Relationships',
    'Career and Money',
    'Wellbeing Habits',
    'Guidance',
  ],
}

const SAMPLE = `> This report is based on traditional numerology and is for reflection and entertainment only.

## Overview

Your life path **11** is a master number: an *intuitive* path that asks you to trust quiet signals.

## Life Path

- Sensitive to atmosphere and people
- Learns by reflecting, then acting

1. Give ideas time to settle
2. Share them once they feel ready

<script>alert('x')</script> stays plain text.`

function ReadingsDemoPage() {
  const { kind, signed, balance } = Route.useSearch()
  const [offer] = useState<ReadingOffer>(() => ({
    available: true,
    credits: 100,
    sections: SECTIONS[kind] ?? SECTIONS['numerology-full'] ?? [],
    packs: [
      {
        planPriceId: '00000000-0000-7000-8000-000000000001',
        provider: 'stripe',
        credits: 100,
        amount: 99,
      },
      {
        planPriceId: '00000000-0000-7000-8000-000000000002',
        provider: 'stripe',
        credits: 500,
        amount: 399,
      },
    ],
    viewer: signed ? { slug: 'demo', balance } : null,
  }))
  return (
    <MarketingShell>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
        <Disclaimer />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
          <div className="rounded-xl border border-line bg-surface p-6 text-ink-muted">
            reading-optin slot
          </div>
          <ReadingUnlock kind={kind} request={{ input: {}, share: {} }} previewOffer={offer} />
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-8">
          <Markdown source={SAMPLE} />
        </div>
      </div>
    </MarketingShell>
  )
}
