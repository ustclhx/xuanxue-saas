// Paraglide 的 inlang 项目、编译选项与文案缺失检查（openspec add-marketing-i18n-seo tasks.md 1.1、1.3）。
//
// 文案按功能拆分为 messages/<locale>/<feature>.json（docs/09-parallel-plan.md §3 第 5 条）。
// project.inlang/settings.json 由这里按模板配置的 i18n 与现有文案文件生成（已 gitignore），
// 语言列表只在 template.config.ts 中维护。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { type CompilerOptions, compile, paraglideVitePlugin } from '@inlang/paraglide-js'
import { EMAIL_LOCALES } from '@xuanxue/email/queue'
import type { Plugin } from 'vite'
import { localeUrlPatterns } from '../src/features/i18n/locale-url.ts'

export interface I18nConfig {
  readonly enabled?: boolean
  readonly locales: readonly string[]
  readonly defaultLocale: string
}

export interface MissingMessage {
  readonly locale: string
  readonly feature: string
  readonly key: string
}

const WEB_ROOT = new URL('..', import.meta.url).pathname
// settings.json 中的相对路径以 project.inlang 的上级目录为基准；文案格式插件从本地加载，构建不依赖 CDN
const MESSAGE_FORMAT_PLUGIN = './node_modules/@inlang/plugin-message-format/dist/index.js'

/** messages/ 下所有语言目录中出现过的功能文件名（不含 .json）；messagesDir 默认为 `<root>/messages` */
export function listFeatures(root = WEB_ROOT, messagesDir = join(root, 'messages')): string[] {
  if (!existsSync(messagesDir)) return []
  const features = new Set<string>()
  for (const locale of readdirSync(messagesDir, { withFileTypes: true })) {
    if (!locale.isDirectory()) continue
    for (const file of readdirSync(join(messagesDir, locale.name))) {
      if (file.endsWith('.json')) features.add(file.slice(0, -'.json'.length))
    }
  }
  return [...features].sort()
}

/** 单语言仍复用 Paraglide 文案调用，只编译所选默认语言。 */
export function activeLocales(i18n: I18nConfig): readonly string[] {
  return i18n.enabled === false ? [i18n.defaultLocale] : i18n.locales
}

/**
 * 全部文案文件的路径模式（相对 root）：核心 messages/ 加上启用插件的文案目录（scripts/plugins 按目标给出，绝对路径）。
 * 未启用插件的目录不在列表中，其消息键不进入 Paraglide 输出。
 */
export function messagePathPatterns(
  root = WEB_ROOT,
  messageDirs: readonly string[] = [],
): string[] {
  const patterns = listFeatures(root).map((feature) => `./messages/{locale}/${feature}.json`)
  for (const dir of messageDirs) {
    const base = relative(root, dir).split(sep).join('/')
    const prefix = base.startsWith('.') ? base : `./${base}`
    for (const feature of listFeatures(root, dir))
      patterns.push(`${prefix}/{locale}/${feature}.json`)
  }
  return patterns
}

/** 写入 `<root>/project.inlang/settings.json`；内容未变化时不写，避免触发 Paraglide 重新编译 */
export function writeInlangProject(
  i18n: I18nConfig,
  root = WEB_ROOT,
  messageDirs: readonly string[] = [],
): void {
  const { defaultLocale } = i18n
  const locales = activeLocales(i18n)
  const settings = {
    $schema: 'https://inlang.com/schema/project-settings',
    baseLocale: defaultLocale,
    locales: [...locales],
    modules: [MESSAGE_FORMAT_PLUGIN],
    'plugin.inlang.messageFormat': {
      pathPattern: messagePathPatterns(root, messageDirs),
    },
  }
  const projectDir = join(root, 'project.inlang')
  const path = join(projectDir, 'settings.json')
  const content = `${JSON.stringify(settings, null, 2)}\n`
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(path, content)
}

/**
 * Paraglide 编译选项（design.md 决策 3）：公开页面按 URL 前缀确定语言（默认语言无前缀），
 * 其他配置语言 `/<小写语言 id>/...`（`zh-Hant` → `/zh-hant/`，openspec add-dual-site-foundation 决策 2）；
 * 应用区不进入 URL，按 Cookie 取语言、没有时用默认语言。
 * 两者都不含 preferredLanguage，首次访问不会按浏览器语言自动跳转。
 * 大小写不同的前缀与站点默认语言前缀由站点守卫（features/site/gate.ts）在进入 Paraglide 前 301。
 */
export function paraglideOptions(
  i18n: I18nConfig,
  appAreaPrefixes: readonly string[],
  root = WEB_ROOT,
): CompilerOptions {
  const enabled = i18n.enabled !== false
  return {
    project: join(root, 'project.inlang'),
    outdir: join(root, 'src/paraglide'),
    // tsconfig 未开启 allowJs，生成 .d.ts 供类型检查
    emitTsDeclarations: true,
    strategy: enabled ? ['url', 'baseLocale'] : ['baseLocale'],
    // 小写语言前缀、默认语言放最后作兜底（模板 locale-url.ts，含只差大小写的语言 id 校验）
    urlPatterns: localeUrlPatterns({
      locales: activeLocales(i18n),
      defaultLocale: i18n.defaultLocale,
    }),
    // 与路由器一致：去掉末尾的 `/`（否则 `/ko` 会被本地化为 `/ko/`，再被路由器 307 回来）
    trailingSlash: 'never',
    routeStrategies: (enabled ? [...appAreaPrefixes, '/_serverFn'] : []).map((prefix) => ({
      match: `${prefix}/:path(.*)?`,
      strategy: ['cookie', 'baseLocale'],
    })),
  }
}

function readKeys(path: string): Set<string> {
  if (!existsSync(path)) return new Set()
  const messages = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  return new Set(Object.keys(messages).filter((key) => key !== '$schema'))
}

/**
 * 以默认语言为准，列出其他语言缺失的文案。
 * 缺失的文案在运行时由 Paraglide 回退到默认语言（不会显示键名），这里只负责报告。
 */
export function findMissingMessages(
  { locales, defaultLocale }: I18nConfig,
  root = WEB_ROOT,
  messageDirs: readonly string[] = [],
): MissingMessage[] {
  const missing: MissingMessage[] = []
  for (const messagesDir of [join(root, 'messages'), ...messageDirs]) {
    for (const feature of listFeatures(root, messagesDir)) {
      const base = readKeys(join(messagesDir, defaultLocale, `${feature}.json`))
      for (const locale of locales) {
        if (locale === defaultLocale) continue
        const keys = readKeys(join(messagesDir, locale, `${feature}.json`))
        for (const key of base) if (!keys.has(key)) missing.push({ locale, feature, key })
      }
    }
  }
  return missing
}

/**
 * 严格语言（项目扩展，openspec add-locales-eu-ja 决策 5；模板需求 TR-3）：`locales` 中的语言缺少文案时构建失败，
 * 不回退到默认语言；功能文件名匹配 `lenientFeatures`（后台、UI 预览）的缺失仍只告警。
 * 只检查已配置（参与编译）的语言。
 */
export interface StrictMessages {
  readonly locales: readonly string[]
  readonly lenientFeatures?: readonly RegExp[]
  /** 项目扩展：按语言额外允许回退的功能文件（该语言不提供的工具） */
  readonly lenientByLocale?: Readonly<Record<string, readonly RegExp[]>>
}

/** 缺失项中属于严格语言、且不在宽松功能文件中的项 */
export function strictMissingMessages(
  missing: readonly MissingMessage[],
  strict: StrictMessages | undefined,
): MissingMessage[] {
  if (!strict) return []
  return missing.filter(
    ({ locale, feature }) =>
      strict.locales.includes(locale) &&
      ![...(strict.lenientFeatures ?? []), ...(strict.lenientByLocale?.[locale] ?? [])].some(
        (pattern) => pattern.test(feature),
      ),
  )
}

/** 严格语言缺失项的错误文本；没有时返回 null */
export function formatStrictMissing(missing: readonly MissingMessage[]): string | null {
  if (missing.length === 0) return null
  return [
    `[i18n] 严格语言缺少 ${missing.length} 条文案（不允许回退到默认语言）：`,
    ...missing.map(
      ({ locale, feature, key }) => `  - ${locale}: ${key} (messages/${locale}/${feature}.json)`,
    ),
  ].join('\n')
}

/** 缺失项的日志文本；没有缺失时返回 null */
export function formatMissingMessages(missing: readonly MissingMessage[]): string | null {
  if (missing.length === 0) return null
  return [
    `[i18n] ${missing.length} 条文案缺少翻译，运行时回退到默认语言：`,
    ...missing.map(
      ({ locale, feature, key }) => `  - ${locale}: ${key} (messages/${locale}/${feature}.json)`,
    ),
  ].join('\n')
}

/**
 * Vite 插件：生成 inlang 项目后交给 Paraglide 编译；构建开始时在日志中列出缺失的文案。
 * `api.compile()` 供不经过 vite dev / build 的场景（typecheck 前生成 src/paraglide）使用。
 */
export function i18nMessages({
  i18n,
  appAreaPrefixes,
  strict,
  messageDirs = [],
}: {
  readonly i18n: I18nConfig
  readonly appAreaPrefixes: readonly string[]
  /** 项目扩展：严格语言缺键时构建失败 */
  readonly strict?: StrictMessages
  /** 启用插件的文案目录（绝对路径） */
  readonly messageDirs?: readonly string[]
}): Plugin[] {
  const unsupported = activeLocales(i18n).filter(
    (locale) => !(EMAIL_LOCALES as readonly string[]).includes(locale),
  )
  if (unsupported.length) throw new Error(`[i18n] 邮件模板缺少语言：${unsupported.join(', ')}`)
  writeInlangProject(i18n, WEB_ROOT, messageDirs)
  const options = paraglideOptions(i18n, appAreaPrefixes)
  let reported = false
  return [
    paraglideVitePlugin(options) as Plugin,
    {
      name: 'saas:i18n-messages',
      api: { compile: () => compile(options) },
      buildStart() {
        // client 与 ssr 两个环境各触发一次 buildStart，只报告一次
        if (reported) return
        reported = true
        const missing = findMissingMessages(
          { ...i18n, locales: activeLocales(i18n) },
          WEB_ROOT,
          messageDirs,
        )
        const failures = formatStrictMissing(strictMissingMessages(missing, strict))
        if (failures) this.error(failures)
        const report = formatMissingMessages(missing)
        if (report) this.warn(report)
      },
    },
  ]
}
