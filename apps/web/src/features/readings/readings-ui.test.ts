import { describe, expect, it } from 'vitest'
import { encodeShareInput } from '../tools/share.ts'
import { parseMarkdown } from './markdown.tsx'
import { displayPrice, paypalUsdNotice, priceForCredits } from './price.ts'
import { applyChunk, readReadingStream } from './stream.ts'
import { peekUnlockToken, unlockReturnPath, unlockShareOf } from './unlock.ts'

// add-reading-monetization tasks.md 3.1–3.2：估价、意图令牌、流式解析与白名单 Markdown。

const PACKS = [
  { credits: 500, amount: 22700, currency: 'TWD' },
  { credits: 100, amount: 6500, currency: 'TWD' },
]

describe('按界面语言结算的价格（localize-checkout-currency 5.2）', () => {
  it('取能覆盖所需积分的最小积分包按比例折算，TWD 取整到元', () => {
    expect(priceForCredits(100, PACKS)).toEqual({ amount: 6500, currency: 'TWD' })
    expect(priceForCredits(300, PACKS)).toEqual({ amount: 13600, currency: 'TWD' })
    expect(priceForCredits(800, PACKS)).toEqual({ amount: 36300, currency: 'TWD' })
    expect(priceForCredits(100, [])).toBeNull()
  })

  it('繁体与韩语显示实价不带约值，简体附人民币参考价，英语显示美元', () => {
    expect(displayPrice({ amount: 6500, currency: 'TWD' }, 'zh-Hant')).toEqual({
      text: 'NT$65',
      reference: null,
    })
    expect(displayPrice({ amount: 2800, currency: 'KRW' }, 'ko')).toEqual({
      text: '₩2,800',
      reference: null,
    })
    expect(displayPrice({ amount: 199, currency: 'USD' }, 'zh-Hans')).toEqual({
      text: 'US$1.99',
      reference: '¥13',
    })
    expect(displayPrice({ amount: 199, currency: 'USD' }, 'en')).toEqual({
      text: '$1.99',
      reference: null,
    })
  })

  it('只在繁体与韩语选择 PayPal 时提示以美元结算', () => {
    expect(paypalUsdNotice('ko', 'paypal')).toBe(true)
    expect(paypalUsdNotice('zh-Hant', 'paypal')).toBe(true)
    expect(paypalUsdNotice('ko', 'stripe')).toBe(false)
    expect(paypalUsdNotice('zh-Hans', 'paypal')).toBe(false)
    expect(paypalUsdNotice('en', 'paypal')).toBe(false)
  })
})

describe('意图令牌', () => {
  const body = (payload: unknown) =>
    btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const payload = {
    v: 1,
    kind: 'bazi-full',
    share: { year: '1990', unknownTime: false },
    returnTo: '/zh-hant',
    exp: Date.now() + 1000,
  }

  it('浏览器端读取令牌正文中的分享输入，用于恢复 #r= 结果', () => {
    const token = `${body(payload)}.sig`
    expect(peekUnlockToken(token)).toEqual(payload)
    expect(unlockShareOf(`?unlock=${token}&checkout=success`)).toEqual(payload.share)
    expect(unlockShareOf('?x=1')).toBeNull()
    expect(peekUnlockToken('not-json.sig')).toBeNull()
    expect(peekUnlockToken(`${body({ ...payload, v: 2 })}.sig`)).toBeNull()
  })

  it('回跳地址可以通过 safeReturnPath 的字符集', () => {
    const path = unlockReturnPath('/zh-hant', `${body(payload)}.abc_-`)
    expect(path).toMatch(/^\/zh-hant\?unlock=[\w\-.]+$/)
    expect(encodeShareInput(payload.share)).toMatch(/^[\w-]+$/)
  })
})

describe('报告流解析', () => {
  it('累积 text-delta，error 标记失败', () => {
    let state = { text: '', done: false, failed: false }
    state = applyChunk(state, { type: 'text-delta', id: 't', delta: '## 總' })
    state = applyChunk(state, { type: 'text-delta', id: 't', delta: '論' })
    state = applyChunk(state, { type: 'start' })
    expect(state.text).toBe('## 總論')
    expect(applyChunk(state, { type: 'error', errorText: 'x' }).failed).toBe(true)
  })

  it('跨读取块的 SSE 行与多字节字符', async () => {
    const bytes = new TextEncoder().encode(
      'data: {"type":"text-delta","id":"t","delta":"八字"}\n\ndata: {"type":"finish"}\n\n',
    )
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 40))
        controller.enqueue(bytes.slice(40))
        controller.close()
      },
    })
    const seen: string[] = []
    const result = await readReadingStream(stream, (s) => seen.push(s.text))
    expect(result).toEqual({ text: '八字', done: true, failed: false })
  })
})

describe('白名单 Markdown', () => {
  it('只识别标题、段落、引用、列表与分隔线，其余为文本', () => {
    const blocks = parseMarkdown(
      '# 總論\n\n第一段\n續行\n\n> 聲明\n\n- 一\n- 二\n\n1. 甲\n\n---\n\n#### 小節\n\n<img src=x onerror=alert(1)> [link](javascript:alert(1))',
    )
    expect(blocks).toEqual([
      { type: 'heading', level: 2, text: '總論' },
      { type: 'paragraph', text: '第一段 續行' },
      { type: 'quote', text: '聲明' },
      { type: 'list', ordered: false, items: ['一', '二'] },
      { type: 'list', ordered: true, items: ['甲'] },
      { type: 'rule' },
      { type: 'heading', level: 3, text: '小節' },
      { type: 'paragraph', text: '<img src=x onerror=alert(1)> [link](javascript:alert(1))' },
    ])
  })
})
