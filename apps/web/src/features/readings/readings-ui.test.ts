import { describe, expect, it } from 'vitest'
import { encodeShareInput } from '../tools/share.ts'
import { parseMarkdown } from './markdown.tsx'
import { formatPrice, usdCentsFor } from './price.ts'
import { applyChunk, readReadingStream } from './stream.ts'
import { peekUnlockToken, unlockReturnPath, unlockShareOf } from './unlock.ts'

// add-reading-monetization tasks.md 3.1–3.2：估价、意图令牌、流式解析与白名单 Markdown。

const PACKS = [
  { credits: 500, amount: 399 },
  { credits: 100, amount: 99 },
]

describe('当地货币估价', () => {
  it('取能覆盖所需积分的最小积分包折算美元', () => {
    expect(usdCentsFor(100, PACKS)).toBe(99)
    expect(usdCentsFor(300, PACKS)).toBe(239)
    expect(usdCentsFor(800, PACKS)).toBe(638)
    expect(usdCentsFor(100, [])).toBeNull()
  })

  it('按站点语言显示约值：韩元取整到百，新台币显示 NT$，英语显示美元标价', () => {
    expect(formatPrice(99, 'ko')).toEqual({ text: '₩1,400', approximate: true })
    expect(formatPrice(99, 'zh-Hant')).toEqual({ text: 'NT$32', approximate: true })
    expect(formatPrice(1000, 'zh-Hans')).toEqual({ text: '¥67', approximate: true })
    expect(formatPrice(99, 'en')).toEqual({ text: '$0.99', approximate: false })
  })

  it('优先使用实时汇率，缺少的货币回退到参考值', () => {
    const live = {
      perUsd: { KRW: 1300, CNY: 7 },
      attribution: { text: 'Rates By Exchange Rate API', href: 'https://www.exchangerate-api.com' },
    }
    expect(formatPrice(99, 'ko', live)).toEqual({ text: '₩1,300', approximate: true })
    expect(formatPrice(99, 'zh-Hant', live)).toEqual({ text: 'NT$32', approximate: true })
    expect(formatPrice(1000, 'zh-Hans', live)).toEqual({ text: '¥70', approximate: true })
    expect(formatPrice(1000, 'zh-Hans', { ...live, perUsd: {} })).toEqual({
      text: '¥67',
      approximate: true,
    })
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
