// 新语言文案按语言拆分（openspec add-locales-eu-ja design 决策 11「首页脚本」，tasks 1.6）。本文件归项目所有。
//
// Paraglide 的 message-modules 输出里，每条文案模块含全部语言的字符串（`ja_key`、`es_key` 等函数与按语言分派的
// `if (locale === "ja") return ja_key(inputs)`）。客户端首页闭包约有 500 条文案，每加一种语言整体约 +12KB gzip，
// 两种新语言即超出首页包预算（实测见 PR / 证据目录）。
//
// Paraglide 自带的方案不适用：experimentalStaticLocale / per-locale build 要为每种语言各构建一份客户端图并按语言
// 分发静态资源，与 TanStack Start 的 buildApp 编排冲突；experimentalMiddlewareLocaleSplitting 不支持客户端路由。
// 因此在客户端构建中自行拆分「拆分语言」（rollout.ts 的严格语言，即 v1 之后的新语言）：
//   1. 文案模块（transform）：删除拆分语言的函数定义与分派行，回退行改为先查表：
//      `return splitMessage(locale, <序号>, en_key)(inputs)`，查不到时照常回退到基础语言；
//      v1 四种语言的函数原样保留，现有页面的输出与行为不变。
//   2. 每种拆分语言生成一个字典分包（虚拟模块 `virtual:locale-split/<语言>`）：`{ <序号>: <该语言的函数> }`，
//      内容直接取自 Paraglide 编译输出，与原函数逐字相同。
//   3. 加载（src/features/i18n/split-messages.ts）：客户端入口在水合前按当前语言加载对应字典，与 StartClient 并行；
//      v1 语言页面不加载任何字典。服务端构建不经过本插件，SSR 与预渲染照常输出完整文案，水合前后一致。
//   语言切换是整页导航（locale-switch.ts），客户端路由内不会切换语言，不需要按导航再加载。
// 只在 `vite build` 的客户端环境生效；dev 使用 locale-modules 输出，不处理（dev 下各语言照常内联）。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizePath, type Plugin } from 'vite'

const VIRTUAL_PREFIX = 'virtual:locale-split/'
const RESOLVED_PREFIX = `\0${VIRTUAL_PREFIX}`
// split-messages.ts 中由本插件替换的加载器表
const LOADERS_PLACEHOLDER = 'const loaders: Loaders = {}'

interface Definition {
  readonly start: number
  readonly end: number
  /** 函数表达式源码（不含 `const name =` 与类型注释）；别名时为 null */
  readonly body: string | null
  /** `const ja_x = en_x;` 这类别名（Paraglide 对相同文案去重）的目标 */
  readonly alias: string | null
}

/** 文案模块中的函数定义：`const <name> = ... (...) => {...\n};` 或别名 `const <name> = <other>;` */
function definitions(code: string): Map<string, Definition> {
  const result = new Map<string, Definition>()
  for (const match of code.matchAll(/\nconst (\w+) = /g)) {
    const name = match[1] ?? ''
    const start = (match.index ?? 0) + 1
    const rest = code.slice(start + `const ${name} = `.length)
    const alias = /^(\w+);\n/.exec(rest)
    if (alias?.[1]) {
      result.set(name, {
        start,
        end: start + `const ${name} = `.length + alias[0].length - 1,
        body: null,
        alias: alias[1],
      })
      continue
    }
    const close = code.indexOf('\n};', start)
    if (close === -1) continue
    const end = close + '\n};'.length
    const body = code
      .slice(start + `const ${name} = `.length, end - 1)
      .replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
    result.set(name, { start, end, body, alias: null })
  }
  return result
}

const DISPATCH = /\n\tif \(locale === "([^"]+)"\) return (\w+)\(inputs\)/g
const FALLBACK = /\n\treturn (\w+)\(inputs\)/

export interface SplitResult {
  readonly code: string
  /** 被移出的语言：语言 → 字典中的函数源码；与基础语言文案相同（别名）时为 null，由回退处理 */
  readonly removed: ReadonlyMap<string, string | null>
}

/**
 * 改写一条文案模块：删除 `locales` 中语言的函数与分派行，在基础语言回退前插入查表。
 * 模块不含这些语言时原样返回（removed 为空）。纯函数，便于测试。
 */
export function splitMessageModule(
  code: string,
  index: number,
  locales: readonly string[],
  runtimeId = SPLIT_RUNTIME_ID,
): SplitResult {
  const removed = new Map<string, string | null>()
  const dispatches = [...code.matchAll(DISPATCH)].filter(([, locale]) =>
    locales.includes(locale ?? ''),
  )
  if (dispatches.length === 0) return { code, removed }
  const defs = definitions(code)
  const fallbackName = FALLBACK.exec(code)?.[1]
  if (!fallbackName) throw new Error('[locale-split] 找不到基础语言回退')
  const drop: Definition[] = []
  let next = code
  for (const [line, locale, name] of dispatches) {
    if (!locale || !name) continue
    const own = defs.get(name)
    if (!own) throw new Error(`[locale-split] 找不到文案函数 ${name}`)
    drop.push(own)
    // 沿别名找到实际函数；指向基础语言的别名不进字典（查不到时回退到基础语言，结果相同）
    let target: string = name
    for (let hops = 0; defs.get(target)?.alias && hops < 10; hops++)
      target = defs.get(target)?.alias ?? target
    removed.set(locale, target === fallbackName ? null : (defs.get(target)?.body ?? null))
    next = next.replace(line, '')
  }
  // 从后往前删除定义，前面的位置不受影响（分派行在定义之后，已先删除）
  for (const def of [...new Set(drop)].sort((a, b) => b.start - a.start)) {
    const offset = next.indexOf(code.slice(def.start, def.end))
    if (offset !== -1) next = next.slice(0, offset) + next.slice(offset + def.end - def.start)
  }
  // 拆分语言全部是基础语言的别名（如只在东方站使用的文案）：字典里没有这条，查表必然回退，不加查表调用
  if ([...removed.values()].every((body) => body === null)) return { code: next, removed }
  // 回退行改为先查字典：`return __splitMessage(locale, <序号>, en_x)(inputs)`（查不到时返回基础语言函数），
  // 每条文案只多十个字符左右
  next = next.replace(
    `\n\treturn ${fallbackName}(inputs)`,
    `\n\treturn __splitMessage(locale, ${index}, ${fallbackName})(inputs)`,
  )
  next = next.replace(
    /\nimport /,
    `\nimport { splitMessage as __splitMessage } from ${JSON.stringify(runtimeId)}\nimport `,
  )
  return { code: next, removed }
}

// 查表与加载函数所在的项目文件（由 vite 按路径解析）
let SPLIT_RUNTIME_ID = ''

/** 字典分包源码：`{ <序号>: <函数> }`；函数可能引用 Paraglide 的 registry（复数规则） */
export function dictionarySource(
  entries: ReadonlyMap<number, string>,
  registryId: string,
  pageCopyId?: string,
): string {
  const lines = [...entries].sort(([a], [b]) => a - b).map(([index, body]) => `${index}: ${body},`)
  // 该语言按语言拆分的页面 SEO 文案（features/i18n/page-copy.ts）随字典一起加载，不再单独发起请求
  const pageCopy = pageCopyId
    ? `export { default as pageCopy } from ${JSON.stringify(pageCopyId)}\n`
    : ''
  return `import * as registry from ${JSON.stringify(registryId)}\n${pageCopy}export default {\n${lines.join('\n')}\n}\n`
}

/**
 * 全站静态闭包（入口与路由树的静态部分，每个页面都会下载）中常见的文案前缀。序号越小，每条查表调用越短；
 * 这些前缀排在前面，首页闭包里约 500 条文案的序号多为 1–3 位数（2026-11-20 实测首页闭包按前缀：daily 105、
 * bazi 82、auth 58、account 57、numerology 56、marketing 23、pricing 14 …）。只影响体积，不影响正确性。
 */
export const SHELL_PREFIXES = [
  'theme',
  'i18n',
  'date',
  'site',
  'common',
  'tools',
  'account',
  'readings',
  'auth',
  'daily',
  'marketing',
  'pricing',
  'numerology',
  'bazi',
] as const

/** 文案序号顺序：SHELL_PREFIXES 中的前缀按列表顺序在前，其余按键名 */
export function messageOrder(keys: readonly string[]): string[] {
  const rank = (key: string) => {
    const position = (SHELL_PREFIXES as readonly string[]).indexOf(key.split('_')[0] ?? '')
    return position === -1 ? SHELL_PREFIXES.length : position
  }
  return [...keys].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
}

export function localeSplit({
  locales,
  paraglideDir,
  runtimeFile,
  pageCopyDir,
}: {
  /** 拆分到按需字典的语言（只处理已配置的语言） */
  readonly locales: readonly string[]
  /** Paraglide 编译输出目录（src/paraglide） */
  readonly paraglideDir: string
  /** 查表与加载函数所在的文件（src/features/i18n/split-messages.ts） */
  readonly runtimeFile: string
  /** 各语言页面 SEO 文案目录（`<目录>/<语言>.ts`，存在时随字典导出） */
  readonly pageCopyDir?: string
}): Plugin {
  const messagesDir = normalizePath(join(paraglideDir, 'messages'))
  const runtime = normalizePath(runtimeFile)
  SPLIT_RUNTIME_ID = runtime
  let keys: Map<string, number> | null = null
  const keyIndex = () => {
    // 序号与生成顺序无关：客户端与字典分包在同一次构建中使用同一张表（messageOrder）
    keys ??= new Map(
      messageOrder(
        (existsSync(messagesDir) ? readdirSync(messagesDir) : [])
          .filter((name) => name.endsWith('.js') && !name.startsWith('_'))
          .map((name) => name.slice(0, -'.js'.length)),
      ).map((key, index) => [key, index]),
    )
    return keys
  }
  const isClient = (environment: { name: string } | undefined) => environment?.name === 'client'
  return {
    name: 'xuanxue:locale-split',
    apply: 'build',
    // pre：split-messages.ts 以 TypeScript 源码匹配占位；文案模块是纯 JS，前后无差别
    enforce: 'pre',
    buildStart() {
      keys = null
    },
    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX))
        return `${RESOLVED_PREFIX}${id.slice(VIRTUAL_PREFIX.length)}`
      return null
    },
    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null
      const locale = id.slice(RESOLVED_PREFIX.length)
      // 字典直接取自编译输出（与 transform 的处理顺序无关）：该语言的全部文案函数
      const entries = new Map<number, string>()
      for (const [key, index] of keyIndex()) {
        const code = readFileSync(join(messagesDir, `${key}.js`), 'utf8')
        const body = splitMessageModule(code, index, [locale]).removed.get(locale)
        if (body) entries.set(index, body)
      }
      const pageCopy = pageCopyDir ? normalizePath(join(pageCopyDir, `${locale}.ts`)) : undefined
      return dictionarySource(
        entries,
        normalizePath(join(paraglideDir, 'registry.js')),
        pageCopy && existsSync(pageCopy) ? pageCopy : undefined,
      )
    },
    transform(code, id) {
      if (!isClient(this.environment) || locales.length === 0) return null
      const file = normalizePath(id.split('?')[0] ?? '')
      if (file === runtime) {
        if (!code.includes(LOADERS_PLACEHOLDER))
          this.error('[locale-split] split-messages.ts 缺少加载器占位')
        const loaders = locales
          .map(
            (locale) =>
              `${JSON.stringify(locale)}: () => import(${JSON.stringify(`${VIRTUAL_PREFIX}${locale}`)})`,
          )
          .join(', ')
        return {
          code: code.replace(LOADERS_PLACEHOLDER, `const loaders: Loaders = { ${loaders} }`),
          map: null,
        }
      }
      if (!file.startsWith(`${messagesDir}/`) || !file.endsWith('.js')) return null
      const key = file.slice(messagesDir.length + 1, -'.js'.length)
      const index = keyIndex().get(key)
      if (index === undefined) return null
      const result = splitMessageModule(code, index, locales)
      return result.removed.size ? { code: result.code, map: null } : null
    },
  }
}
