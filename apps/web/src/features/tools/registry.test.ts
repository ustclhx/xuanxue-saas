import { describe, expect, it } from 'vitest'
import { defineToolRoutes, type RegisteredToolRoute, TOOL_ROUTES } from './registry.ts'

const yearly = {
  id: 'yearly',
  site: 'east',
  paths: { en: '/yearly-outlook' },
  titles: { en: 'Yearly Outlook' },
  directoryGroup: 'yearly',
  freeLabel: 'free_lookup',
} satisfies RegisteredToolRoute

describe('工具注册表', () => {
  it.each([
    ['east', 'bazi', 'chart', 'free_chart'],
    ['east', 'saju-gunghap', 'relation', 'free_compatibility'],
    ['east', 'tarot-three-card', 'divination', 'free_draw'],
    ['west', 'tarot-three-card', 'tarot', 'free_draw'],
    ['west', 'life-path', 'numerology', 'free_calculate'],
    ['west', 'life-path-compatibility', 'compatibility', 'free_compatibility'],
    ['east', 'almanac', 'calendar', 'free_lookup'],
  ])('%s/%s 分到 %s 并提供 %s 标签', (site, id, directoryGroup, freeLabel) => {
    expect(TOOL_ROUTES.find((route) => route.id === id && route.site === site)).toMatchObject({
      directoryGroup,
      freeLabel,
    })
  })

  it('拒绝把东方工具登记到西方站目录分组', () => {
    expect(() => defineToolRoutes([{ ...yearly, directoryGroup: 'moon' }])).toThrow(
      'Invalid directoryGroup for east/yearly',
    )
  })

  it('支持闰年到期日及省略小标', () => {
    const routes: RegisteredToolRoute[] = [
      yearly,
      { ...yearly, id: 'yearly-2028', badge: { kind: 'year', label: '2028', until: '2028-02-29' } },
    ]
    expect(defineToolRoutes(routes)).toEqual(routes)
  })

  it.each(['2027-02-29', '2027-04-31', '2027-2-08', '2027-02-28T00:00:00Z'])(
    '拒绝无效的小标到期日 %s',
    (until) => {
      expect(() => defineToolRoutes([{ ...yearly, badge: { kind: 'new', until } }])).toThrow(
        'Invalid badge.until for east/yearly',
      )
    },
  )
})
