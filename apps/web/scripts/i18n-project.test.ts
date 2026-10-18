import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '@inlang/paraglide-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  activeLocales,
  findMissingMessages,
  formatMissingMessages,
  paraglideOptions,
  writeInlangProject,
} from './i18n-project.ts'

const i18n = { locales: ['en', 'zh-Hant', 'ko'], defaultLocale: 'en' }
let root: string

function writeMessages(locale: string, feature: string, messages: Record<string, string>) {
  mkdirSync(join(root, 'messages', locale), { recursive: true })
  writeFileSync(join(root, 'messages', locale, `${feature}.json`), JSON.stringify(messages))
}

// 临时的 apps/web 结构：中文 common.json 删掉了一条文案
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'xuanxue-i18n-'))
  symlinkSync(new URL('../node_modules', import.meta.url).pathname, join(root, 'node_modules'))
  writeMessages('en', 'common', { common_save: 'Save', common_cancel: 'Cancel' })
  writeMessages('zh-Hant', 'common', { common_save: '儲存' })
  writeMessages('en', 'pricing', { pricing_title: 'Pricing' })
  writeMessages('zh-Hant', 'pricing', { pricing_title: '定價' })
  writeMessages('ko', 'common', { common_save: '저장', common_cancel: '취소' })
  writeMessages('ko', 'pricing', { pricing_title: '요금제' })
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('文案回退与缺失检查（tasks.md 1.3）', () => {
  it('缺失检查以默认语言为准列出缺失项', () => {
    const missing = findMissingMessages(i18n, root)
    expect(missing).toEqual([{ locale: 'zh-Hant', feature: 'common', key: 'common_cancel' }])
    expect(formatMissingMessages(missing)).toContain(
      'zh-Hant: common_cancel (messages/zh-Hant/common.json)',
    )
    expect(formatMissingMessages([])).toBeNull()
  })

  it('按功能拆分的文案文件编译后，缺失的中文文案回退到默认语言文本而不是键名', async () => {
    writeInlangProject(i18n, root)
    await compile({ ...paraglideOptions(i18n, [], root), emitTsDeclarations: false })
    const { m } = (await import(join(root, 'src/paraglide/messages.js'))) as {
      m: Record<string, (inputs?: object, options?: { locale: string }) => string>
    }
    expect(m.common_save?.({}, { locale: 'zh-Hant' })).toBe('儲存')
    expect(m.pricing_title?.({}, { locale: 'zh-Hant' })).toBe('定價')
    expect(m.common_cancel?.({}, { locale: 'zh-Hant' })).toBe('Cancel')
    expect(m.pricing_title?.({}, { locale: 'ko' })).toBe('요금제')
  })

  it('语言前缀使用小写语言 id，默认语言无前缀（add-dual-site-foundation 1.2）', async () => {
    const runtime = await import(join(root, 'src/paraglide/runtime.js'))
    const url = (path: string) => `https://xuanxue-east.example${path}`
    expect(runtime.localizeUrl(url('/pricing'), { locale: 'zh-Hant' }).pathname).toBe(
      '/zh-hant/pricing',
    )
    expect(runtime.localizeUrl(url('/zh-hant/pricing'), { locale: 'ko' }).pathname).toBe(
      '/ko/pricing',
    )
    expect(runtime.deLocalizeUrl(url('/zh-hant/pricing')).pathname).toBe('/pricing')
    expect(runtime.extractLocaleFromUrl(url('/zh-hant'))).toBe('zh-Hant')
    expect(runtime.extractLocaleFromUrl(url('/ko/pricing'))).toBe('ko')
    // 已移除的 /zh 与大写写法不是语言前缀，按默认语言的普通路径处理（路由器找不到页面而 404）
    for (const path of ['/zh/pricing', '/zh-Hant/pricing', '/pricing'])
      expect(runtime.extractLocaleFromUrl(url(path))).toBe('en')
  })
})

it('关闭 i18n 后真实编译仅保留默认繁中，账号 Cookie 和语言 URL 不改变语言', async () => {
  const singleRoot = mkdtempSync(join(tmpdir(), 'xuanxue-i18n-single-'))
  try {
    symlinkSync(
      new URL('../node_modules', import.meta.url).pathname,
      join(singleRoot, 'node_modules'),
    )
    for (const [locale, text] of [
      ['en', 'Save'],
      ['zh-Hant', '儲存'],
      ['ko', '저장'],
    ] as const) {
      mkdirSync(join(singleRoot, 'messages', locale), { recursive: true })
      writeFileSync(
        join(singleRoot, 'messages', locale, 'common.json'),
        JSON.stringify({ common_save: text }),
      )
    }
    const single = { ...i18n, enabled: false, defaultLocale: 'zh-Hant' }
    expect(activeLocales(single)).toEqual(['zh-Hant'])
    expect(activeLocales(i18n)).toEqual(['en', 'zh-Hant', 'ko'])
    writeInlangProject(single, singleRoot)
    const options = paraglideOptions(single, ['/app', '/account'], singleRoot)
    expect(options.strategy).toEqual(['baseLocale'])
    expect(options.routeStrategies ?? []).toEqual([])
    await compile({ ...options, emitTsDeclarations: false })
    const runtime = await import(join(singleRoot, 'src/paraglide/runtime.js'))
    const { m } = await import(join(singleRoot, 'src/paraglide/messages.js'))
    const { paraglideMiddleware } = await import(join(singleRoot, 'src/paraglide/server.js'))
    expect(runtime.locales).toEqual(['zh-Hant'])
    expect(runtime.baseLocale).toBe('zh-Hant')
    expect(m.common_save()).toBe('儲存')
    for (const path of ['/app', '/en/pricing', '/zh-hant/pricing']) {
      const response = await paraglideMiddleware(
        new Request(`https://xuanxue-west.example${path}`, {
          headers: { cookie: 'PARAGLIDE_LOCALE=en' },
        }),
        () => new Response(runtime.getLocale()),
      )
      expect(await response.text()).toBe('zh-Hant')
      expect(response.headers.get('location')).toBeNull()
    }
  } finally {
    rmSync(singleRoot, { recursive: true, force: true })
  }
})
