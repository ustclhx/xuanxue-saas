import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SiteContext } from '../../site/context.tsx'
import { ToolForm } from '../form.tsx'
import { decodeShareInput, encodeShareInput } from '../share.ts'
import { BirthFields } from './birth-fields.tsx'
import {
  BIRTH_STORAGE_KEY,
  defaultBirthValues,
  fromShareInput,
  KO_TRUE_SOLAR_DEFAULT,
  loadBirthValues,
  readBirthForm,
  saveBirthValues,
  toBirthInput,
  toShareInput,
} from './birth-form-state.ts'
import { conceptPath, easternPageOf } from './eastern-routes.ts'
import { lunarDateZh } from './glyphs.ts'
import { easternToolHead } from './head.ts'

const messages = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

const sample = {
  ...defaultBirthValues('zh-Hant'),
  year: '1990',
  month: '5',
  day: '15',
  time: '10:30',
}

function render(node: ReactNode) {
  return renderToString(<SiteContext value="east">{node}</SiteContext>)
}

describe('出生信息表单状态', () => {
  it('换算为引擎输入；不知道时辰时 time 为 null', () => {
    expect(toBirthInput(sample)).toEqual({
      ok: true,
      input: {
        calendar: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        time: { hour: 10, minute: 30 },
        gender: 'male',
        location: { city: 'taipei' },
        trueSolarTime: false,
      },
    })
    const unknown = toBirthInput({ ...sample, unknownTime: true, time: '' })
    expect(unknown.ok && unknown.input.time).toBeNull()
  })

  it('缺少必填项时给出字段级错误，不调用引擎', () => {
    const result = toBirthInput({ ...sample, year: '', time: '' })
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: 'year', code: 'required' },
        { field: 'time', code: 'required' },
      ],
    })
  })

  it('农历带闰月，手选时区带经度', () => {
    const result = toBirthInput({
      ...sample,
      calendar: 'lunar',
      leap: true,
      place: 'other',
      utcOffset: '-300',
      longitude: '-74.0',
    })
    expect(result.ok && result.input).toMatchObject({
      calendar: 'lunar',
      isLeapMonth: true,
      location: { utcOffsetMinutes: -300, longitude: -74 },
    })
  })

  it('双人表单按前缀读取 FormData', () => {
    const data = new FormData()
    data.set('b_calendar', 'lunar')
    data.set('b_gender', 'female')
    data.set('b_year', ' 1992 ')
    data.set('b_unknownTime', 'on')
    data.set('a_year', '1990')
    const values = readBirthForm(data, 'b_')
    expect(values).toMatchObject({
      calendar: 'lunar',
      gender: 'female',
      year: '1992',
      unknownTime: true,
    })
  })

  it('韩语页진태양시默认开启（决策 D5 的单一常量）', () => {
    expect(KO_TRUE_SOLAR_DEFAULT).toBe(true)
    expect(defaultBirthValues('ko').place).toBe('seoul')
  })
})

describe('跨页保留输入', () => {
  it('八字页保存的输入在紫微页读取后带入表单', () => {
    const storage = memoryStorage()
    // 八字页：访客填写后写入
    saveBirthValues(storage, BIRTH_STORAGE_KEY, { ...sample, gender: 'female' })
    // 紫微页：挂载时读取，作为非受控控件的默认值重新渲染
    const restored = loadBirthValues(storage, BIRTH_STORAGE_KEY, defaultBirthValues('zh-Hant'))
    expect(restored).toMatchObject({ year: '1990', month: '5', day: '15', gender: 'female' })
    const html = render(
      <ToolForm label="出生資料" onSubmit={() => {}}>
        <BirthFields values={restored ?? sample} locale="zh-Hant" />
      </ToolForm>,
    )
    expect(html).toMatch(/name="year"[^>]*value="1990"|value="1990"[^>]*name="year"/)
    expect(html).toMatch(/name="time"[^>]*value="10:30"|value="10:30"[^>]*name="time"/)
    expect(html).toMatch(/value="female"[^>]*checked|checked[^>]*value="female"/)
  })

  it('存储不可用或内容被篡改时静默失败，不影响使用', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const fallback = defaultBirthValues('zh-Hant')
    expect(loadBirthValues(throwing, BIRTH_STORAGE_KEY, fallback)).toBeNull()
    expect(() => saveBirthValues(throwing, BIRTH_STORAGE_KEY, sample)).not.toThrow()
    const storage = memoryStorage()
    storage.setItem(BIRTH_STORAGE_KEY, '{"calendar":"gregorian"}')
    expect(loadBirthValues(storage, BIRTH_STORAGE_KEY, fallback)).toBeNull()
    storage.setItem(BIRTH_STORAGE_KEY, 'not json')
    expect(loadBirthValues(storage, BIRTH_STORAGE_KEY, fallback)).toBeNull()
  })

  it('分享片段往返：单人与带前缀的双人输入', () => {
    const fallback = defaultBirthValues('ko')
    const shared = decodeShareInput(
      encodeShareInput({
        ...toShareInput(sample, 'a_'),
        ...toShareInput({ ...sample, year: '1992' }, 'b_'),
      }),
    )
    expect(shared).not.toBeNull()
    expect(fromShareInput(shared ?? {}, fallback, 'a_')).toEqual(sample)
    expect(fromShareInput(shared ?? {}, fallback, 'b_')?.year).toBe('1992')
    expect(fromShareInput({}, fallback)).toBeNull()
  })
})

describe('出生信息字段', () => {
  it('服务端输出真实 label、fieldset/legend 与字段级错误', () => {
    const html = render(
      <ToolForm label="出生資料" onSubmit={() => {}}>
        <BirthFields
          values={{ ...sample, calendar: 'lunar' }}
          locale="zh-Hant"
          issues={[{ field: 'leapMonth', code: 'leap_month_not_exist' }]}
        />
      </ToolForm>,
    )
    expect(html).toMatch(/<legend[^>]*>曆法<\/legend>/)
    expect(html).toMatch(/<legend[^>]*>性別<\/legend>/)
    expect(html).toMatch(/<legend[^>]*>出生日期<\/legend>/)
    expect(html).toContain('閏月')
    expect(html).toContain('該年沒有這個閏月。')
    expect(html).toContain('不知道出生時辰')
    expect(html).toMatch(/<option value="taipei"[^>]*>台北<\/option>/)
  })
})

describe('东方站路径', () => {
  it('slug 映射接受 Unicode 与百分号编码，语言不符时不匹配', () => {
    expect(easternPageOf('zh-Hant', '紫微斗數排盤')).toBe('ziwei')
    expect(easternPageOf('zh-Hant', encodeURIComponent('命盤查詢'))).toBe('mingpan')
    expect(easternPageOf('ko', '사주궁합')).toBe('gunghap')
    expect(easternPageOf('ko', '紫微斗數排盤')).toBeUndefined()
    expect(easternPageOf('en', 'pricing')).toBeUndefined()
  })

  it('概念页路径与农历日期格式', () => {
    expect(conceptPath('zh-Hant', 'luck')).toBe('/八字/大運')
    expect(conceptPath('ko', 'void')).toBe('/사주/공망')
    expect(conceptPath('ko', 'weight')).toBeUndefined()
    expect(lunarDateZh({ year: 1990, month: 4, day: 21, isLeapMonth: false })).toBe('四月廿一')
    expect(lunarDateZh({ year: 2023, month: 2, day: 10, isLeapMonth: true })).toBe('閏二月初十')
  })
})

describe('东方站排盘页 head', () => {
  it('Title 按设计文档原文；八字排盤与만세력互指 hreflang，紫微页只有繁中', () => {
    const title = '免費八字排盤｜生辰八字命盤查詢、大運流年與喜用神線上解析'
    const home = easternToolHead(
      { path: '/', locale: 'zh-Hant', title, description: 'd' },
      'http://localhost',
    )
    expect(home.meta).toContainEqual({ title })
    const languages = (links: typeof home.links) =>
      links.flatMap((link) => ('hrefLang' in link ? [link.hrefLang] : []))
    expect(languages(home.links)).toEqual(['zh-Hant', 'ko', 'x-default'])
    const ziwei = easternToolHead(
      { path: '/紫微斗數排盤', locale: 'zh-Hant', title: 't', description: 'd' },
      'http://localhost',
    )
    expect(languages(ziwei.links)).toEqual(['zh-Hant', 'x-default'])
    const canonical = ziwei.links.find((link) => link.rel === 'canonical')?.href ?? ''
    expect(decodeURI(new URL(canonical).pathname)).toBe('/zh-hant/紫微斗數排盤')
  })
})
