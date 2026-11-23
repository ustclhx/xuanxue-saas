// @vitest-environment happy-dom
import { computeCompatibility } from '@xuanxue/bazi'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPAT_READING_LOCALES } from '../../readings/release.ts'
import { SiteContext } from '../../site/context.tsx'
import { decodeShareInput, encodeShareInput, readShareFragment, SHARE_PARAM } from '../share.ts'
import {
  BIRTH_STORAGE_KEY,
  type BirthFormValues,
  LEGACY_PARTNER_STORAGE_KEY,
  toBirthInput,
  toShareInput,
} from './birth-form-state.ts'
import { fromCompatShare, toCompatShare } from './compat-share.ts'
import { easternPageOf } from './eastern-routes.ts'
import { GunghapPage, GunghapResult } from './gunghap-page.tsx'
import { easternPageCopy, easternToolHead } from './head.ts'

const messages = vi.hoisted(() => ({ locale: 'ko' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})
// 解锁卡读取运行时报价（服务端函数），这里只区分「可购买」与「即将开放」两种插槽
vi.mock('../../readings/unlock-card.tsx', () => ({
  // 与真实卡片一致：结果出现前（request 为 null）不渲染
  ReadingUnlock: ({ note, request }: { note?: string; request: unknown }) =>
    request ? <section data-testid="reading-unlock">{note}</section> : null,
  ReadingComingSoon: () => <section data-testid="reading-coming-soon" />,
}))

function render(node: ReactNode) {
  return renderToString(<SiteContext value="east">{node}</SiteContext>)
}

/** React useId 的自增 id 与本次改动无关：去掉，快照只锁结构与文案 */
function normalize(html: string): string {
  return html.replace(/_R_[0-9a-zA-Z]+_/g, '_id_').replaceAll('<!-- -->', '')
}

const values = (
  year: string,
  month: string,
  day: string,
  time: string,
  gender: 'male' | 'female',
): BirthFormValues => ({
  calendar: 'solar',
  leap: false,
  gender,
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

const ME = values('1990', '5', '15', '10:30', 'male')
const PARTNER = values('1991', '11', '11', '14:00', 'female')

function compute(a: BirthFormValues, b: BirthFormValues) {
  const pa = toBirthInput(a)
  const pb = toBirthInput(b)
  if (!pa.ok || !pb.ok) throw new Error('sample input invalid')
  return computeCompatibility(pa.input, pb.input, { referenceYear: 2026 })
}

describe('ko 사주궁합 快照（content-growth-v2-tools 12.1：多语言化前后 ko 输出不变）', () => {
  // 基线为多语言化之前的输出；与基线的差别只有 12.2 的对方资料用途说明与进度条的 role="meter"
  it('H1、简介与双人表单', () => {
    messages.locale = 'ko'
    expect(normalize(render(<GunghapPage />))).toMatchSnapshot()
  })

  it('结果区：分数、分项与两人的四柱', () => {
    messages.locale = 'ko'
    expect(
      normalize(render(<GunghapResult result={compute(ME, PARTNER)} share={{}} />)),
    ).toMatchSnapshot()
  })
})

describe('合盘工具的语言版本（12.1、12.3）', () => {
  it.each([
    ['zh-Hans', '八字合盘', '免费合盘只用对方的出生资料计算本次结果'],
    ['zh-Hant', '八字合盤', '免費試算只會用對方的生辰排這次合盤'],
    ['ja', '四柱推命の相性', 'お相手の出生情報は今回の計算にのみ使い'],
    ['en', 'BaZi Compatibility Calculator', 'birth details only for this result'],
    ['ko', '사주궁합', '상대의 출생 정보는 이번 계산에만 쓰이며'],
  ] as const)('%s：H1、双人表单与常显的用途说明，公开文案不提 AI', (locale, h1, note) => {
    messages.locale = locale
    const html = render(<GunghapPage />)
    expect(html).toContain(`>${h1}</h1>`)
    expect(html).toContain('name="a_year"')
    expect(html).toContain('name="b_year"')
    const partnerNote = /<p data-partner-note=""[^>]*>[\s\S]*?<\/p>/.exec(html)?.[0] ?? ''
    expect(partnerNote).toContain(note)
    // 用途说明在提交按钮之前，不收进折叠
    expect(html.indexOf('data-partner-note')).toBeLessThan(html.indexOf('type="submit"'))
    expect(partnerNote).not.toContain('<details')
    expect(html).not.toMatch(/\bAI\b/)
  })

  it('五种语言互为 hreflang，canonical 指向自身', () => {
    const languages = (links: ReturnType<typeof easternToolHead>['links']) =>
      links.flatMap((link) => ('hrefLang' in link ? [link.hrefLang] : []))
    for (const [locale, path] of [
      ['zh-Hans', '/八字合盘'],
      ['zh-Hant', '/八字合盤'],
      ['ko', '/사주궁합'],
      ['ja', '/四柱推命相性'],
      ['en', '/bazi-compatibility'],
    ] as const) {
      messages.locale = locale
      expect(easternPageOf(locale, path.slice(1))).toBe('gunghap')
      const head = easternToolHead(
        { site: 'east', path, locale, ...easternPageCopy('gunghap') },
        'http://localhost',
      )
      expect(languages(head.links)).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'ja', 'en', 'x-default'])
      expect(head.links).toContainEqual({
        rel: 'alternate',
        hrefLang: 'ko',
        href: `https://ganjiday.com${encodeURI('/ko/사주궁합')}`,
      })
      expect(head.links).toContainEqual({
        rel: 'alternate',
        hrefLang: 'en',
        href: 'https://ganjiday.com/bazi-compatibility',
      })
      const canonical = head.links.find((link) => link.rel === 'canonical')?.href ?? ''
      const prefix = locale === 'en' ? '' : `/${locale.toLowerCase()}`
      expect(decodeURI(new URL(canonical).pathname)).toBe(`${prefix}${path}`)
      expect(JSON.stringify(head.links)).not.toContain('arcanumber.com')
    }
  })

  it('已开放详批的语言只有 ko；其余语言之后加入时须已有 catalog 变体并通过评测门槛', async () => {
    const { readingDefinition, readingEvalPassed } = await import('../../readings/catalog.ts')
    expect(COMPAT_READING_LOCALES).toEqual(['ko'])
    for (const locale of COMPAT_READING_LOCALES) {
      expect(readingDefinition('saju-compat', locale)).toBeTruthy()
      expect(readingEvalPassed('saju-compat', locale)).toBe(true)
    }
  })
})

describe('分享片段（12.2：新生成的不含出生资料，旧链接兼容读取）', () => {
  it('新版只含分数、各项关系与场景，往返后自洽；篡改的分数被拒绝', () => {
    const result = compute(ME, PARTNER)
    const share = toCompatShare(result, 'general')
    const decoded = decodeShareInput(encodeShareInput(share))
    if (!decoded) throw new Error('share not decodable')
    expect(Object.keys(decoded).sort()).toEqual(['base', 'compat', 'items', 'scenario', 'score'])
    const text = JSON.stringify(decoded)
    for (const birth of ['1990', '1991', '10:30', '14:00', 'seoul', 'female', 'male'])
      expect(text).not.toContain(birth)
    expect(fromCompatShare(decoded)).toEqual({
      score: result.score,
      base: result.base,
      items: result.items.map(({ key, delta }) => ({ key, delta })),
      scenario: 'general',
    })
    expect(fromCompatShare({ ...decoded, score: 3 })).toBeNull()
    expect(fromCompatShare({ ...decoded, items: 'unknownKey:5' })).toBeNull()
    // 旧版片段（带两人资料）不是新版
    expect(
      fromCompatShare({ ...toShareInput(ME, 'a_'), ...toShareInput(PARTNER, 'b_') }),
    ).toBeNull()
  })
})

describe('对方资料不保存（12.2，浏览器内）', () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  async function mount(locale: string, hash = '') {
    messages.locale = locale
    window.history.replaceState(null, '', `/page${hash}`)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () =>
      root?.render(
        <SiteContext value="east">
          <GunghapPage />
        </SiteContext>,
      ),
    )
  }

  function unmount() {
    act(() => root?.unmount())
    container?.remove()
    container = null
    root = null
  }

  afterEach(() => {
    unmount()
    window.sessionStorage.clear()
    window.localStorage?.clear()
    vi.unstubAllGlobals()
  })

  const field = (name: string) =>
    container?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? null

  function fill(prefix: string, v: BirthFormValues) {
    for (const key of ['year', 'month', 'day', 'time'] as const) {
      const input = container?.querySelector<HTMLInputElement>(`input[name="${prefix}${key}"]`)
      if (!input) throw new Error(`missing ${prefix}${key}`)
      input.value = v[key]
    }
  }

  async function submit() {
    await act(async () => {
      container?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }))
    })
    // 引擎按需加载：等计算完成
    for (let i = 0; i < 50 && !container?.querySelector('[data-score]'); i++)
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
  }

  it('关闭标签页后再打开：本人资料保留，对方字段为空，浏览器存储没有对方资料；旧会话的对方值被清除', async () => {
    window.sessionStorage.setItem(LEGACY_PARTNER_STORAGE_KEY, JSON.stringify(PARTNER))
    await mount('zh-Hans')
    expect(window.sessionStorage.getItem(LEGACY_PARTNER_STORAGE_KEY)).toBeNull()
    expect(field('b_year')).toBe('')
    fill('a_', ME)
    fill('b_', PARTNER)
    await submit()
    expect(container?.querySelector('[data-score]')).not.toBeNull()
    const stored = [
      ...Object.values({ ...window.sessionStorage }),
      ...Object.values({ ...(window.localStorage ?? {}) }),
    ].join('\n')
    expect(stored).toContain('1990')
    expect(stored).not.toContain('1991')
    // 新生成的分享链接不含任何一方的生日
    const href = container?.querySelector<HTMLInputElement>('input[readonly]')?.value ?? ''
    const shared = readShareFragment(new URL(href).hash)
    expect(shared && fromCompatShare(shared)).toBeTruthy()
    expect(JSON.stringify(shared)).not.toMatch(/1990|1991/)
    // 未开放详批的语言显示「即将开放」占位
    expect(container?.querySelector('[data-testid="reading-coming-soon"]')).not.toBeNull()
    expect(container?.querySelector('[data-testid="reading-unlock"]')).toBeNull()
    unmount()
    await mount('zh-Hans')
    expect(field('a_year')).toBe('1990')
    expect(field('b_year')).toBe('')
    expect(window.sessionStorage.getItem(BIRTH_STORAGE_KEY)).toContain('1990')
  })

  it('ko 开放详批：解锁卡带上「对方资料随报告保存」的说明，不显示占位', async () => {
    await mount('ko')
    fill('a_', ME)
    fill('b_', PARTNER)
    await submit()
    const unlock = container?.querySelector('[data-testid="reading-unlock"]')
    expect(unlock?.textContent).toContain('리포트와 함께 저장')
    expect(container?.querySelector('[data-testid="reading-coming-soon"]')).toBeNull()
  })

  it('旧版分享链接（带两人资料）仍可打开并重新计算，对方资料只填进表单、不写入存储', async () => {
    const legacy = encodeShareInput({ ...toShareInput(ME, 'a_'), ...toShareInput(PARTNER, 'b_') })
    await mount('ko', `#${SHARE_PARAM}=${legacy}`)
    for (let i = 0; i < 50 && !container?.querySelector('[data-score]'); i++)
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(container?.querySelector('[data-score]')?.getAttribute('data-score')).toBe(
      String(compute(ME, PARTNER).score),
    )
    expect(field('b_year')).toBe('1991')
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('1991')
  })

  it('新版分享链接只展示分数与关系，不填表单、不显示四柱', async () => {
    const result = compute(ME, PARTNER)
    const fragment = encodeShareInput(toCompatShare(result, 'general'))
    await mount('zh-Hans', `#${SHARE_PARAM}=${fragment}`)
    expect(container?.querySelector('[data-score]')?.getAttribute('data-score')).toBe(
      String(result.score),
    )
    expect(container?.textContent).toContain('不含两人的出生资料')
    expect(container?.querySelector('#pillars')).toBeNull()
    expect(field('a_year')).toBe('')
    expect(field('b_year')).toBe('')
  })

  it('对方时辰未知：按三柱计算并在结果中说明', async () => {
    await mount('zh-Hans')
    fill('a_', ME)
    fill('b_', { ...PARTNER, time: '' })
    const unknown = container?.querySelector<HTMLInputElement>('input[name="b_unknownTime"]')
    if (!unknown) throw new Error('missing b_unknownTime')
    unknown.checked = true
    await submit()
    expect(container?.querySelector('#score')?.textContent).toContain(
      '对方没有填写出生时间，按年、月、日三柱排盘',
    )
  })
})
