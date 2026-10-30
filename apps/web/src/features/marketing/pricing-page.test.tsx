import type { SiteId } from '@xuanxue/config'
import type { SettingKey, SettingsContext } from '@xuanxue/db'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PricingPage } from './pricing-page.tsx'
import { siteReadingPricing } from './reading-pricing.server.ts'

const language = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => ({
  ...(await original<typeof import('../../paraglide/runtime.js')>()),
  getLocale: () => language.locale,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock('./marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('../growth/forms.tsx', () => ({ GrowthForm: () => null }))
vi.mock('../readings/readings.functions.ts', () => ({ getLocalRates: vi.fn() }))

function settings(overrides: Partial<Record<SettingKey, unknown>> = {}): SettingsContext {
  return {
    store: {
      find: vi.fn(async (key: SettingKey) => {
        if (Object.hasOwn(overrides, key)) return overrides[key]
        return key.endsWith('.modelKey') ? 'deepseek-flash' : undefined
      }),
    },
  }
}

describe('定价页可解锁目录', () => {
  it.each([
    [
      'west',
      'en',
      ['numerology-full', 'tarot-spread'],
      ['Your full numerology reading', 'Full spread reading'],
    ],
    [
      'east',
      'zh-Hant',
      ['bazi-full', 'ziwei-full', 'tarot-spread'],
      ['完整命盤分析', '完整紫微命盤分析', '完整牌陣解讀'],
    ],
    [
      'east',
      'zh-Hans',
      ['bazi-full', 'ziwei-full', 'tarot-spread'],
      ['完整命盘分析', '完整紫微命盘分析', '完整牌阵解读'],
    ],
    [
      'east',
      'ko',
      ['saju-full', 'saju-compat', 'tarot-spread'],
      ['사주 상세 풀이', '궁합 상세 풀이', '스프레드 상세 리딩'],
    ],
  ] as const)(
    '%s / %s 只列出本站本语言可解析的详批（包含塔罗）',
    async (site, locale, kinds, labels) => {
      language.locale = locale
      const readings = await siteReadingPricing(site, locale, settings())
      expect(readings.map((reading) => reading.kind)).toEqual(kinds)
      const html = renderToStaticMarkup(
        <PricingPage catalog={{ plans: [], prices: [], providers: [] }} readings={readings} />,
      )
      const list = html.match(/<section aria-labelledby="pricing-readings"[\s\S]*?<\/section>/)?.[0]
      expect([...(list?.matchAll(/<li>(.*?)<\/li>/g) ?? [])].map((match) => match[1])).toEqual(
        labels,
      )
    },
  )

  it.each([
    ['west', 'zh-Hans'],
    ['east', 'en'],
  ] as const)('拒绝 %s 站不提供的 %s 语言且不读取运营设置', async (site: SiteId, locale) => {
    const ctx = settings()
    expect(await siteReadingPricing(site, locale, ctx)).toEqual([])
    expect(ctx.store.find).not.toHaveBeenCalled()
  })

  it('关闭、未配置模型或零积分的详批不出现在可解锁清单', async () => {
    const ctx = settings({
      'readings.saju-full.enabled': false,
      'readings.saju-compat.modelKey': '',
      'readings.tarot-spread.credits': 0,
    })
    const readings = await siteReadingPricing('east', 'ko', ctx)
    expect(readings).toEqual([])
    const html = renderToStaticMarkup(
      <PricingPage catalog={{ plans: [], prices: [], providers: [] }} readings={readings} />,
    )
    expect(html).not.toContain('aria-labelledby="pricing-readings"')
  })
})
