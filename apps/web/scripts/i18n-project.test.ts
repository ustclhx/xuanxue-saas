import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '@inlang/paraglide-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  activeLocales,
  findMissingMessages,
  formatMissingMessages,
  formatStrictMissing,
  paraglideOptions,
  strictMissingMessages,
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

  it('严格语言（新语言）缺键时报错并列出语言、文件与键名；后台文件与非严格语言只告警', () => {
    const missing = [
      { locale: 'ja', feature: 'bazi', key: 'bazi_title' },
      { locale: 'ja', feature: 'admin-daily-credits', key: 'admin_x' },
      { locale: 'ja', feature: 'ui-preview', key: 'ui_x' },
      // 按语言放宽：ja 不提供每日运势，es 仍须齐全
      { locale: 'ja', feature: 'daily', key: 'daily_x' },
      { locale: 'es', feature: 'daily', key: 'daily_x' },
      { locale: 'zh-Hant', feature: 'common', key: 'common_cancel' },
    ]
    const strict = {
      locales: ['ja', 'es'],
      lenientFeatures: [/^admin(-|$)/, /^ui-preview(-|$)/],
      lenientByLocale: { ja: [/^daily$/] },
    }
    const failures = strictMissingMessages(missing, strict)
    expect(failures).toEqual([
      { locale: 'ja', feature: 'bazi', key: 'bazi_title' },
      { locale: 'es', feature: 'daily', key: 'daily_x' },
    ])
    expect(formatStrictMissing(failures)).toContain('ja: bazi_title (messages/ja/bazi.json)')
    expect(strictMissingMessages(missing, undefined)).toEqual([])
    expect(formatStrictMissing([])).toBeNull()
  })

  it('严格语言整个功能文件缺失时，每条键都算缺失', () => {
    writeMessages('ja', 'pricing', { pricing_title: '料金' })
    const missing = findMissingMessages({ locales: ['en', 'ja'], defaultLocale: 'en' }, root)
    expect(strictMissingMessages(missing, { locales: ['ja'] })).toEqual([
      { locale: 'ja', feature: 'common', key: 'common_save' },
      { locale: 'ja', feature: 'common', key: 'common_cancel' },
    ])
    rmSync(join(root, 'messages', 'ja'), { recursive: true, force: true })
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
    const url = (path: string) => `https://ganjiday.com${path}`
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
        new Request(`https://arcanumber.com${path}`, {
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

it('含大写字母的语言 id 编译为小写前缀，localize / deLocalize 与中间件一致（multilingual-seo 2.2）', async () => {
  const mixedRoot = mkdtempSync(join(tmpdir(), 'xuanxue-i18n-mixed-'))
  try {
    symlinkSync(
      new URL('../node_modules', import.meta.url).pathname,
      join(mixedRoot, 'node_modules'),
    )
    const mixed = { locales: ['en', 'zh-Hant'], defaultLocale: 'en' }
    for (const [locale, text] of [
      ['en', 'Save'],
      ['zh-Hant', '儲存'],
    ] as const) {
      mkdirSync(join(mixedRoot, 'messages', locale), { recursive: true })
      writeFileSync(
        join(mixedRoot, 'messages', locale, 'common.json'),
        JSON.stringify({ common_save: text }),
      )
    }
    writeInlangProject(mixed, mixedRoot)
    const options = paraglideOptions(mixed, ['/app'], mixedRoot)
    await compile({ ...options, emitTsDeclarations: false })
    const runtime = await import(join(mixedRoot, 'src/paraglide/runtime.js'))
    const { paraglideMiddleware } = await import(join(mixedRoot, 'src/paraglide/server.js'))
    const origin = 'https://xuanxue-west.example'
    const localize = (path: string, locale: string) =>
      runtime.localizeUrl(`${origin}${path}`, { locale }).pathname
    expect(localize('/pricing', 'zh-Hant')).toBe('/zh-hant/pricing')
    expect(localize('/', 'zh-Hant')).toBe('/zh-hant')
    expect(localize('/zh-hant/pricing', 'en')).toBe('/pricing')
    expect(runtime.deLocalizeUrl(`${origin}/zh-hant/pricing?x=1`).href).toBe(
      `${origin}/pricing?x=1`,
    )
    expect(runtime.extractLocaleFromUrl(`${origin}/zh-hant/pricing`)).toBe('zh-Hant')
    expect(runtime.extractLocaleFromUrl(`${origin}/pricing`)).toBe('en')
    // 请求头与 Cookie 不影响公开页语言，也不触发跳转
    for (const [path, locale, routed] of [
      ['/zh-hant/pricing', 'zh-Hant', '/pricing'],
      ['/zh-hant', 'zh-Hant', '/'],
      ['/pricing', 'en', '/pricing'],
    ] as const) {
      const response = await paraglideMiddleware(
        new Request(`${origin}${path}`, {
          headers: {
            'sec-fetch-dest': 'document',
            'accept-language': 'zh-TW',
            cookie: 'PARAGLIDE_LOCALE=zh-Hant',
          },
        }),
        ({ request }: { request: Request }) =>
          new Response(`${runtime.getLocale()} ${new URL(request.url).pathname}`),
      )
      expect(response.status, path).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(await response.text()).toBe(`${locale} ${routed}`)
    }
  } finally {
    rmSync(mixedRoot, { recursive: true, force: true })
  }
})
it('只编译启用插件的文案目录，关闭插件时 Paraglide 输出中没有其消息键（add-plugin-system 3.3）', async () => {
  const pluginRoot = mkdtempSync(join(tmpdir(), 'xuanxue-i18n-plugin-'))
  try {
    const webRoot = join(pluginRoot, 'apps/web')
    const pluginMessages = join(pluginRoot, 'plugins/example/messages')
    mkdirSync(webRoot, { recursive: true })
    symlinkSync(new URL('../node_modules', import.meta.url).pathname, join(webRoot, 'node_modules'))
    for (const [dir, feature, messages] of [
      [
        join(webRoot, 'messages'),
        'common',
        { en: { common_save: 'Save' }, zh: { common_save: '保存' } },
      ],
      [pluginMessages, 'example', { en: { example_title: 'Example' }, zh: {} }],
    ] as const) {
      for (const [locale, values] of Object.entries(messages)) {
        mkdirSync(join(dir, locale), { recursive: true })
        writeFileSync(join(dir, locale, `${feature}.json`), JSON.stringify(values))
      }
    }
    // 启用：插件文案进入路径模式与缺失检查，编译后可用
    const pluginI18n = { locales: ['en', 'zh'], defaultLocale: 'en' }
    writeInlangProject(pluginI18n, webRoot, [pluginMessages])
    expect(findMissingMessages(pluginI18n, webRoot, [pluginMessages])).toEqual([
      { locale: 'zh', feature: 'example', key: 'example_title' },
    ])
    await compile({ ...paraglideOptions(pluginI18n, [], webRoot), emitTsDeclarations: false })
    const enabled = await import(`${join(webRoot, 'src/paraglide/messages.js')}?enabled`)
    expect(enabled.m.example_title?.({}, { locale: 'en' })).toBe('Example')
    // 关闭：重新生成后输出中没有插件的消息键
    rmSync(join(webRoot, 'src/paraglide'), { recursive: true, force: true })
    writeInlangProject(pluginI18n, webRoot)
    await compile({ ...paraglideOptions(pluginI18n, [], webRoot), emitTsDeclarations: false })
    // 模块缓存会保留上一次的消息模块，这里直接检查编译输出的文本
    const output = readdirSync(join(webRoot, 'src/paraglide'), {
      recursive: true,
      encoding: 'utf8',
    })
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFileSync(join(webRoot, 'src/paraglide', file), 'utf8'))
      .join('\n')
    expect(output).toContain('common_save')
    expect(output).not.toContain('example_title')
  } finally {
    rmSync(pluginRoot, { recursive: true, force: true })
  }
})
