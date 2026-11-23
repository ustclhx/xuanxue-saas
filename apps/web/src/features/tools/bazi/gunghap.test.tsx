import { computeCompatibility } from '@xuanxue/bazi'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SiteContext } from '../../site/context.tsx'
import { toBirthInput } from './birth-form-state.ts'
import { GunghapPage, GunghapResult } from './gunghap-page.tsx'

const messages = vi.hoisted(() => ({ locale: 'ko' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})
// 解锁卡读取运行时报价（服务端函数），快照只锁页面自身的输出
vi.mock('../../readings/unlock-card.tsx', () => ({
  ReadingUnlock: () => null,
  ReadingComingSoon: () => <section data-testid="reading-coming-soon" />,
}))

function render(node: ReactNode) {
  return renderToString(<SiteContext value="east">{node}</SiteContext>)
}

/** React 的 useId 在两次渲染之间稳定，但快照只关心结构与文案：去掉自增 id 以免无关改动打破快照 */
function normalize(html: string): string {
  return html.replace(/_R_[0-9a-z]+_/g, '_id_').replaceAll('<!-- -->', '')
}

const values = (year: string, month: string, day: string, time: string, gender: string) => ({
  calendar: 'solar' as const,
  leap: false,
  gender: gender as 'male' | 'female',
  year,
  month,
  day,
  time,
  unknownTime: time === '',
  place: 'seoul',
  utcOffset: '540',
  longitude: '',
  trueSolar: true,
})

function sampleResult() {
  const a = toBirthInput(values('1990', '5', '15', '10:30', 'male'))
  const b = toBirthInput(values('1991', '11', '11', '14:00', 'female'))
  if (!a.ok || !b.ok) throw new Error('sample input invalid')
  return computeCompatibility(a.input, b.input, { referenceYear: 2026 })
}

describe('ko 사주궁합 快照（content-growth-v2-tools 12.1：多语言化前后 ko 输出不变）', () => {
  it('H1、简介与双人表单', () => {
    messages.locale = 'ko'
    expect(normalize(render(<GunghapPage />))).toMatchSnapshot()
  })

  it('结果区：分数、分项与两人的四柱', () => {
    messages.locale = 'ko'
    expect(normalize(render(<GunghapResult result={sampleResult()} share={{}} />))).toMatchSnapshot()
  })
})
