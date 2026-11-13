import { dailyRelations, dayPillarOf, STEMS } from '@xuanxue/bazi'
import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../marketing/prerender.ts'
import { sitemap } from '../seo/crawlers.ts'
import { alternateLinks } from '../seo/metadata.ts'
import { publicPages } from '../seo/pages.ts'
import { tenGodTip } from './copy.ts'
import { dateKey, dayNumber, parseDateKey, referenceDate, secondsUntilDayEnd } from './date.ts'
import { loadEastDaily } from './east-page.tsx'
import { eastPersonalFacts, tenGodFor, westPersonalFacts } from './facts.ts'
import { ZH_HANT_RULES } from './rules/zh-Hant.ts'
import { loadWestDaily } from './west-page.tsx'

// 公开页 loader 不得访问数据库或会话：运行时一旦被读取即失败
vi.mock('../../server/runtime.ts', () => ({
  getWebRuntime: () => {
    throw new Error('daily loader must not touch the runtime / database')
  },
}))

describe('参考日期', () => {
  // UTC 2026-11-13 17:30：台北、首尔已是 11-14，纽约仍是 11-13
  const now = new Date('2026-11-13T17:30:00Z')

  it('按站点语言的参考时区确定今日', () => {
    expect(dateKey(referenceDate('zh-Hant', now))).toBe('2026-11-14')
    expect(dateKey(referenceDate('zh-Hans', now))).toBe('2026-11-14')
    expect(dateKey(referenceDate('ko', now))).toBe('2026-11-14')
    expect(dateKey(referenceDate('en', now))).toBe('2026-11-13')
  })

  it('民用日界：台北 23:30 仍是当日', () => {
    expect(dateKey(referenceDate('zh-Hant', new Date('2026-11-13T15:30:00Z')))).toBe('2026-11-13')
    expect(dateKey(referenceDate('zh-Hant', new Date('2026-11-13T16:00:00Z')))).toBe('2026-11-14')
  })

  it('距参考日结束的秒数', () => {
    // 台北 01:30 → 还剩 22.5 小时
    expect(secondsUntilDayEnd('zh-Hant', now)).toBe(22.5 * 3600)
    // 纽约 12:30（EST）→ 还剩 11.5 小时
    expect(secondsUntilDayEnd('en', now)).toBe(11.5 * 3600)
  })

  it('解析日期键并拒绝不存在的日期', () => {
    expect(parseDateKey('2026-02-29')).toBeNull()
    expect(parseDateKey('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 })
    expect(dayNumber({ year: 1970, month: 1, day: 2 })).toBe(1)
  })
})

describe('事实与文案', () => {
  it('十神计算与引擎一致（10 × 10）', () => {
    const day = dayPillarOf({ year: 2026, month: 11, day: 13 })
    for (const master of STEMS) {
      for (const other of STEMS) {
        const engine = dailyRelations(
          {
            dayMaster: master,
            pillars: {
              year: { branch: 'zi' },
              month: { branch: 'zi' },
              day: { branch: 'zi' },
              hour: null,
            },
          },
          { ...day, stem: other },
        )
        expect(tenGodFor(master, other), `${master}/${other}`).toBe(engine.tenGod)
      }
    }
  })

  it('spec「查看日主提示」：丙日对庚金日主为七杀，并取七杀的规则提示', () => {
    expect(tenGodFor('geng', 'bing')).toBe('qiSha')
    const tip = tenGodTip(ZH_HANT_RULES, 'qiSha', '2026-11-13')
    expect(ZH_HANT_RULES.tenGod.qiSha).toContain(tip)
  })

  it('同一类文案按日期确定性轮换', () => {
    const a = tenGodTip(ZH_HANT_RULES, 'biJian', '2026-11-13')
    expect(tenGodTip(ZH_HANT_RULES, 'biJian', '2026-11-13')).toBe(a)
    expect(tenGodTip(ZH_HANT_RULES, 'biJian', '2026-11-14')).not.toBe(a)
  })

  it('时辰未知时只比较三支', async () => {
    const engine = await import('@xuanxue/bazi/daily')
    // 2026-11-13 的日支与「辰」相冲时应标出日支冲
    const day = engine.dayPillarOf({ year: 2026, month: 11, day: 13 })
    const facts = eastPersonalFacts(
      engine,
      { dayMaster: 'geng', branches: { year: 'chen', month: 'chen', day: 'chen' } },
      { year: 2026, month: 11, day: 13 },
    )
    expect(facts.relations.every((relation) => relation.natal !== 'hour')).toBe(true)
    expect(facts.tenGod).toBe(tenGodFor('geng', day.stem))
  })

  it('spec「计算个人日」：5 月 15 日在 2026-11-13 的三段归约', () => {
    const facts = westPersonalFacts(
      { year: 1990, month: 5, day: 15 },
      { year: 2026, month: 11, day: 13 },
    )
    // 个人年：5 + 6 + 1 = 12 → 3；个人月：3 + 11 = 14 → 5；个人日：5 + 4 = 9
    expect(facts.personalYear.value).toBe(3)
    expect(facts.personalMonth.value).toBe(5)
    expect(facts.personalDay.value).toBe(9)
    expect(facts.personalDay.steps.at(0)).toMatchObject({ phase: 'day', operands: [1, 3] })
  })
})

describe('公开页 loader', () => {
  it('只按日期计算，不访问运行时与数据库', async () => {
    const east = await loadEastDaily({ year: 2026, month: 11, day: 13 })
    expect(east.date).toBe('2026-11-13')
    expect(east.facts.stem).toBe(dayPillarOf({ year: 2026, month: 11, day: 13 }).stem)
    const west = loadWestDaily({ year: 2026, month: 11, day: 13 })
    // 2026 → 1，11 保留主数，13 → 4；1 + 11 + 4 = 16 → 7
    expect(west.facts.universal.value).toBe(7)
  })
})

describe('收录', () => {
  const pages = publicPages({ posts: [], legal: [], docs: [] }, new Date(), templateConfig)

  it('繁体子站点地图含每日页并指向简体与韩语版本', () => {
    const xml = sitemap(pages, 'https://ganjiday.com', 'zh-Hant')
    expect(xml).toContain(encodeURI('/zh-hant/每日運勢'))
    expect(xml).toContain(encodeURI('/zh-hans/每日运势'))
    expect(xml).toContain(encodeURI('/ko/오늘의-운세'))
  })

  it('西方站每日页只声明英语', () => {
    const links = alternateLinks(
      'https://arcanumber.com',
      '/daily-numerology',
      undefined,
      undefined,
      'en',
    )
    expect(links.map((link) => link.hrefLang).sort()).toEqual(['en', 'x-default'])
  })

  it('每日页不进构建期预渲染', () => {
    const locales = templateConfig.i18n.locales
    expect(isPrerenderedPath('/zh-hant/每日運勢', locales)).toBe(false)
    expect(isPrerenderedPath('/daily-numerology', locales)).toBe(false)
    const entries = prerenderEntryPages(templateConfig).map((page) => page.path)
    for (const path of [
      '/zh-hant/每日運勢',
      '/zh-hans/每日运势',
      '/ko/오늘의-운세',
      '/daily-numerology',
    ])
      expect(entries).not.toContain(path)
  })
})
