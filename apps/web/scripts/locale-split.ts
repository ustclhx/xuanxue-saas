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
import { normalizePath, type Plugin, parseAst } from 'vite'

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
  // 拆分语言的文案都与基础语言相同（别名）时不需要查表：删去分派后自然回退到基础语言
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
  locale?: string,
): string {
  const lines = [...entries].sort(([a], [b]) => a - b).map(([index, body]) => `${index}: ${body},`)
  // 文案表补丁随字典求值时写入（水合前）；只有字典分包引用 installTextPack，未配置新语言时它与 localeText 一起被摇掉
  const text = locale
    ? `import { installTextPack } from ${JSON.stringify(SPLIT_RUNTIME_ID)}\ninstallTextPack(${JSON.stringify(locale)}, ${JSON.stringify(textPlaceholder(locale))})\n`
    : ''
  return `import * as registry from ${JSON.stringify(registryId)}\n${text}export default {\n${lines.join('\n')}\n}\n`
}

/**
 * 字典分包中按语言文案表补丁的占位：transform 阶段还没有收集完所有模块，补丁在 renderChunk（所有模块已转换）
 * 时以 JSON 写入。压缩器可能把字符串改成模板字面量，匹配时三种引号都接受。
 */
export function textPlaceholder(locale: string): string {
  return `__xuanxue_locale_text_${locale}__`
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
}: {
  /** 拆分到按需字典的语言（只处理已配置的语言） */
  readonly locales: readonly string[]
  /** Paraglide 编译输出目录（src/paraglide） */
  readonly paraglideDir: string
  /** 查表与加载函数所在的文件（src/features/i18n/split-messages.ts） */
  readonly runtimeFile: string
}): Plugin[] {
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
  // 按语言文案表补丁：语言 → 调用点标识 → 补丁（transform 收集，renderChunk 写入字典分包）
  const texts = new Map<string, Map<string, [(string | number)[], unknown][]>>()
  const textIds = new Map<string, string>()
  const messages: Plugin = {
    name: 'xuanxue:locale-split',
    apply: 'build',
    // pre：split-messages.ts 以 TypeScript 源码匹配占位；文案模块是纯 JS，前后无差别
    enforce: 'pre',
    buildStart() {
      keys = null
      texts.clear()
      textIds.clear()
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
      return dictionarySource(entries, normalizePath(join(paraglideDir, 'registry.js')), locale)
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
  // 文案表在 TypeScript 去除之后处理（普通顺序）：`as const`、`satisfies` 已不在 AST 中
  const text: Plugin = {
    name: 'xuanxue:locale-split-text',
    apply: 'build',
    transform(code, id) {
      // 未配置新语言时也处理：去掉全部包装
      if (!isClient(this.environment)) return null
      const file = normalizePath(id.split('?')[0] ?? '')
      if (file.includes('/node_modules/') || !/\.[cm]?[jt]sx?$/.test(file)) return null
      if (!code.includes('localeText(')) return null
      const relative = file.includes('/src/') ? file.slice(file.lastIndexOf('/src/') + 1) : file
      const result = splitLocaleText(code, locales, relative)
      for (const [callId, byLocale] of result.patches) {
        const owner = textIds.get(callId)
        if (owner && owner !== relative)
          this.error(`[locale-split] localeText 调用点标识冲突：${owner} 与 ${relative}`)
        textIds.set(callId, relative)
        for (const [locale, patch] of byLocale) {
          const pack = texts.get(locale) ?? new Map()
          pack.set(callId, patch)
          texts.set(locale, pack)
        }
      }
      return result.code === code ? null : { code: result.code, map: null }
    },
    renderChunk(code) {
      if (!isClient(this.environment) || locales.length === 0) return null
      let next = code
      for (const locale of locales) {
        const placeholder = textPlaceholder(locale)
        if (!next.includes(placeholder)) continue
        const pack = Object.fromEntries(
          [...(texts.get(locale) ?? new Map())].sort(([a], [b]) => (a < b ? -1 : 1)),
        )
        next = next.replace(new RegExp(`(["'\`])${placeholder}\\1`), () => JSON.stringify(pack))
      }
      return next === code ? null : { code: next, map: null }
    },
  }
  return [messages, text]
}

// ---------------------------------------------------------------------------------------------
// 按语言文案表（localeText）的拆分：注册表、SEO 页面文案、牌阵标题等不经 Paraglide 的「语言 → 文案」对象。
// 这些对象由路由 head、页头导航等全站代码引用，整体位于每个首页的静态闭包；每加一种语言，所有首页都要多下载
// 这种语言的标题与描述。源码中把这类对象包一层 `localeText(...)`（src/features/i18n/split-messages.ts），
// 客户端构建时：
//   1. 在被包的对象（可嵌套）中，找出键为拆分语言的属性；值是纯字面量（字符串、数字、数组、对象）时整条移出，
//      值是含动态条目的对象时只移出其中的字面量条目；
//   2. 调用改写为 `localeText(<剩余对象>, "<调用点标识>")`，并标注 PURE（未使用的表照常摇掉）；
//   3. 移出的值按语言收集，renderChunk 时写入该语言的字典分包（`export const text`），水合前随文案字典一起加载，
//      写回原对象。服务端与 dev 不处理，SSR、预渲染输出不变。
// ---------------------------------------------------------------------------------------------

interface AstNode {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly [key: string]: unknown
}

const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string'

class NotStatic extends Error {}

/** 纯字面量求值；遇到变量、调用、展开、计算键等抛出 NotStatic */
function staticValue(node: AstNode): unknown {
  switch (node.type) {
    case 'Literal': {
      if ('regex' in node || 'bigint' in node) throw new NotStatic()
      return node.value
    }
    case 'TemplateLiteral': {
      const quasis = node.quasis as { value: { cooked: string } }[]
      if ((node.expressions as unknown[]).length > 0) throw new NotStatic()
      return quasis[0]?.value.cooked ?? ''
    }
    case 'UnaryExpression': {
      const argument = node.argument as AstNode
      if (
        node.operator === '-' &&
        argument.type === 'Literal' &&
        typeof argument.value === 'number'
      )
        return -argument.value
      throw new NotStatic()
    }
    case 'ArrayExpression':
      return (node.elements as (AstNode | null)[]).map((element) => {
        if (!element) throw new NotStatic()
        return staticValue(element)
      })
    case 'ObjectExpression': {
      const result: Record<string, unknown> = {}
      for (const property of node.properties as AstNode[]) {
        const key = propertyKey(property)
        if (key === null || property.shorthand) throw new NotStatic()
        result[key] = staticValue(property.value as AstNode)
      }
      return result
    }
    default:
      throw new NotStatic()
  }
}

/** 普通属性的键名（标识符或字符串 / 数字字面量）；计算键、展开、方法返回 null */
function propertyKey(property: AstNode): string | null {
  if (property.type !== 'Property' || property.kind !== 'init' || property.method) return null
  if (property.computed) return null
  const key = property.key as AstNode
  if (key.type === 'Identifier') return key.name as string
  if (key.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number'))
    return String(key.value)
  return null
}

export interface TextSplitResult {
  readonly code: string
  /** 调用点标识 → 语言 → 补丁 */
  readonly patches: ReadonlyMap<string, ReadonlyMap<string, [(string | number)[], unknown][]>>
}

/** 调用点标识：文件（相对路径）与调用序号的 FNV-1a 散列，base36；与构建顺序无关 */
export function textCallId(file: string, ordinal: number): string {
  let hash = 0x811c9dc5
  for (const char of `${file}#${ordinal}`) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/**
 * 改写一个模块中的 `localeText(<对象>)` 调用：移出 `locales` 中语言的字面量条目。纯函数，便于测试。
 * `file` 只用于生成调用点标识。没有可移出条目的调用改写为对象本身；模块不含调用时原样返回。
 */
export function splitLocaleText(
  code: string,
  locales: readonly string[],
  file: string,
  callee = 'localeText',
): TextSplitResult {
  const patches = new Map<string, Map<string, [(string | number)[], unknown][]>>()
  if (!code.includes(`${callee}(`)) return { code, patches }
  const calls: AstNode[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (!isNode(node)) return
    const target = node.callee as AstNode | undefined
    if (
      node.type === 'CallExpression' &&
      target?.type === 'Identifier' &&
      target.name === callee &&
      (node.arguments as AstNode[]).length === 1 &&
      (node.arguments as AstNode[])[0]?.type === 'ObjectExpression'
    )
      calls.push(node)
    for (const [key, value] of Object.entries(node)) if (key !== 'type') walk(value)
  }
  walk(parseAst(code, { lang: 'js' } as never))
  if (calls.length === 0) return { code, patches }

  // 按 UTF-16 下标切片：parseAst 返回的 start/end 是 JS 字符串下标
  let next = code
  calls.sort((a, b) => a.start - b.start)
  // 嵌套调用只处理最外层（内层对象已在外层中被遍历）
  const outer = calls.filter(
    (call) =>
      !calls.some((other) => other !== call && other.start <= call.start && call.end <= other.end),
  )
  const replacements: { start: number; end: number; text: string }[] = []
  outer.forEach((call, ordinal) => {
    const id = textCallId(file, ordinal)
    const argument = (call.arguments as AstNode[])[0] as AstNode
    const removed = new Set<AstNode>()
    const dirty = new Set<AstNode>()
    const byLocale = new Map<string, [(string | number)[], unknown][]>()
    const record = (locale: string, path: (string | number)[], value: unknown) => {
      const list = byLocale.get(locale) ?? []
      list.push([path, value])
      byLocale.set(locale, list)
    }
    // 返回该节点内是否有改动；ancestors 用于标记需要重写的祖先
    const visit = (node: AstNode, path: (string | number)[] | null): boolean => {
      let changed = false
      if (node.type === 'ObjectExpression') {
        for (const property of node.properties as AstNode[]) {
          const key = propertyKey(property)
          const value = property.value as AstNode | undefined
          if (key !== null && value && path && locales.includes(key)) {
            try {
              record(key, path, staticValue(value))
              removed.add(property)
              changed = true
              continue
            } catch (error) {
              if (!(error instanceof NotStatic)) throw error
            }
            // 含动态条目的语言对象：只移出其中的字面量条目，动态条目留在原处
            if (value.type === 'ObjectExpression') {
              const partial: Record<string, unknown> = {}
              for (const inner of value.properties as AstNode[]) {
                const innerKey = propertyKey(inner)
                if (innerKey === null || inner.shorthand) continue
                try {
                  partial[innerKey] = staticValue(inner.value as AstNode)
                  removed.add(inner)
                } catch (error) {
                  if (!(error instanceof NotStatic)) throw error
                }
              }
              if (Object.keys(partial).length > 0) {
                record(key, path, partial)
                dirty.add(value)
                dirty.add(property)
                changed = true
              }
            }
            continue
          }
          if (value && property.type === 'Property' && !property.shorthand) {
            const childPath = path && key !== null ? [...path, key] : null
            if (visit(value, childPath)) {
              dirty.add(property)
              changed = true
            }
          }
        }
      } else if (node.type === 'ArrayExpression') {
        const elements = node.elements as (AstNode | null)[]
        // 有展开时下标与源码位置对不上，内部不再定位
        const addressable = elements.every((element) => element?.type !== 'SpreadElement')
        elements.forEach((element, index) => {
          if (element && visit(element, path && addressable ? [...path, index] : null))
            changed = true
        })
      } else {
        // 其他表达式（如 `as const` 已被去掉后的括号、条件式）：继续向下找对象，但路径不可寻址
        for (const [key, value] of Object.entries(node)) {
          if (key === 'type') continue
          for (const child of Array.isArray(value) ? value : [value])
            if (isNode(child) && visit(child, null)) changed = true
        }
      }
      if (changed) dirty.add(node)
      return changed
    }
    visit(argument, [])
    // 没有可移出的条目（含未配置新语言时）：去掉包装，运行时不再引用 localeText，首页闭包不增加
    if (byLocale.size === 0) {
      replacements.push({
        start: call.start,
        end: call.end,
        text: `(${code.slice(argument.start, argument.end)})`,
      })
      return
    }
    patches.set(id, byLocale)

    const render = (node: AstNode): string => {
      if (!dirty.has(node)) return code.slice(node.start, node.end)
      if (
        node.type === 'ObjectExpression' &&
        (node.properties as AstNode[]).some((p) => removed.has(p))
      )
        return `{${(node.properties as AstNode[])
          .filter((property) => !removed.has(property))
          .map(render)
          .join(',')}}`
      const children: AstNode[] = []
      for (const [key, value] of Object.entries(node)) {
        if (key === 'type') continue
        for (const child of Array.isArray(value) ? value : [value])
          if (isNode(child) && dirty.has(child)) children.push(child)
      }
      children.sort((a, b) => a.start - b.start)
      let out = ''
      let position = node.start
      for (const child of children) {
        out += code.slice(position, child.start) + render(child)
        position = child.end
      }
      return out + code.slice(position, node.end)
    }
    replacements.push({
      start: call.start,
      end: call.end,
      text: `/* @__PURE__ */ ${code.slice(call.start, argument.start)}${render(argument)}, ${JSON.stringify(id)}${code.slice(argument.end, call.end)}`,
    })
  })
  for (const { start, end, text } of replacements.sort((a, b) => b.start - a.start))
    next = next.slice(0, start) + text + next.slice(end)
  return { code: next, patches }
}
