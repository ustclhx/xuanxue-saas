import { describe, expect, it } from 'vitest'
import { siteFontHref, siteFontScript } from './theme.ts'

/** 在桩环境中执行内联脚本：返回插入的样式表地址与手动触发 FCP / 计时器的入口 */
function runScript(script: string, { paintTiming = true } = {}) {
  const inserted: string[] = []
  const timers: Array<{ fn: () => void; ms: number }> = []
  let observer: ((list: { getEntriesByName: (name: string) => unknown[] }) => void) | undefined
  const document = {
    createElement: () => ({ rel: '', href: '' }),
    head: { appendChild: (link: { href: string }) => inserted.push(link.href) },
  }
  class PerformanceObserver {
    constructor(cb: typeof observer) {
      observer = cb
    }
    observe() {
      if (!paintTiming) throw new TypeError('paint 不受支持')
    }
  }
  const setTimeout = (fn: () => void, ms: number) => timers.push({ fn, ms })
  const addEventListener = (_type: string, fn: () => void) => timers.push({ fn, ms: -1 })
  new Function('document', 'PerformanceObserver', 'setTimeout', 'addEventListener', script)(
    document,
    PerformanceObserver,
    setTimeout,
    addEventListener,
  )
  return {
    inserted,
    fcp: () => {
      observer?.({ getEntriesByName: (name) => (name === 'first-contentful-paint' ? [{}] : []) })
      for (const t of timers.filter((t) => t.ms === 0)) t.fn()
    },
    fire: (ms: number) => {
      for (const t of timers.filter((t) => t.ms === ms)) t.fn()
    },
  }
}

describe('siteFontScript', () => {
  it('首次内容绘制后才插入本站本语言的字体样式表，且只插入一次', () => {
    const run = runScript(siteFontScript('east', 'zh-Hans'))
    expect(run.inserted).toEqual([])
    run.fcp()
    expect(run.inserted).toEqual([siteFontHref('east', 'zh-Hans')])
    run.fire(3000)
    expect(run.inserted).toHaveLength(1)
  })

  it('不支持 paint 计时时由 load 事件或 3 秒计时兜底', () => {
    const run = runScript(siteFontScript('west', 'en'), { paintTiming: false })
    expect(run.inserted).toEqual([])
    run.fire(-1)
    expect(run.inserted).toEqual([siteFontHref('west', 'en')])
    const late = runScript(siteFontScript('west', 'en'))
    late.fire(3000)
    expect(late.inserted).toEqual([siteFontHref('west', 'en')])
  })
})
