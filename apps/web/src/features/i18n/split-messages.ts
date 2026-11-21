/**
 * 新语言文案的按需字典（openspec add-locales-eu-ja tasks 1.6，构建插件见 scripts/locale-split.ts）。本文件归项目所有。
 *
 * 客户端构建中，拆分语言（v1 之后的新语言）的文案函数不在各文案模块里，而在每种语言一个的字典分包中；
 * 文案模块按序号调用 `splitMessage` 取函数，取不到时回退到基础语言（与 Paraglide 缺失文案的回退相同）。
 * 客户端入口在水合前调用 `loadSplitMessages(当前语言)`；v1 语言与 dev 环境下加载器表为空，什么都不做。
 * 服务端不使用本文件（服务端构建不拆分）。
 *
 * 同一字典分包还带有该语言的「按语言文案表」补丁（`localeText`，见下），求值时调用 installTextPack：注册表、SEO 页面文案等不经 Paraglide 的
 * 按语言对象里，拆分语言的条目在客户端构建中被移出首页闭包，水合前随字典一起加载并写回原对象。
 */
type Message = (inputs: unknown) => string
type Dictionary = Readonly<Record<number, Message>>
/** 一处 localeText 的补丁：[对象内路径, 该语言的值]；值为对象时按键合并（保留未移出的动态条目） */
export type TextPatch = readonly (readonly [readonly (string | number)[], unknown])[]
export type TextPack = Readonly<Record<string, TextPatch>>
type Loaders = Readonly<Record<string, () => Promise<{ default: Dictionary }>>>

// 构建时由 scripts/locale-split.ts 替换为各拆分语言的 import()；dev 与未配置新语言时为空
const loaders: Loaders = {}

let loaded: { locale: string; dictionary: Dictionary } | null = null
let loadedText: { locale: string; pack: TextPack } | null = null
// 已创建的 localeText 对象（按调用点标识，保留最近一次）：字典晚于模块求值加载时据此写回
const textObjects = new Map<string, object>()

/** 文案模块调用：当前已加载字典中该序号的函数；没有时返回基础语言的函数 `fallback` */
export function splitMessage(locale: string, index: number, fallback: Message): Message {
  return (loaded?.locale === locale && loaded.dictionary[index]) || fallback
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function merge(target: Record<string | number, unknown>, key: string | number, value: unknown) {
  const current = target[key]
  if (isPlainObject(value) && isPlainObject(current)) {
    for (const [name, inner] of Object.entries(value)) merge(current, name, inner)
  } else target[key] = value
}

function applyPatch(value: object, locale: string, patch: TextPatch | undefined) {
  for (const [path, entry] of patch ?? []) {
    let target: unknown = value
    for (const step of path) target = (target as Record<string | number, unknown> | null)?.[step]
    if (typeof target === 'object' && target !== null)
      merge(target as Record<string | number, unknown>, locale, entry)
  }
}

/**
 * 按语言文案表的标记：源码中把「语言 → 文案」对象（可嵌套在其他对象 / 数组里）包一层 `localeText(...)`。
 * 服务端、dev 与测试中原样返回；客户端构建由插件移出拆分语言的静态条目并传入调用点标识 `id`，
 * 该语言的字典加载后写回（见 loadSplitMessages）。
 *
 * 约束：被包的对象只能在使用时按语言读取，不要在模块求值时据此派生其他数据（派生时字典可能尚未加载）；
 * 路径、slug 等其他语言页面也要用的数据（hreflang、语言菜单）不要包。
 */
export function localeText<T extends object>(value: T, id?: string): T {
  if (id === undefined) return value
  textObjects.set(id, value)
  if (loadedText) applyPatch(value, loadedText.locale, loadedText.pack[id])
  return value
}

/** 写入某语言的文案表补丁（由字典分包调用）：已创建的对象立即写回，之后创建的对象在 localeText 中写回 */
export function installTextPack(locale: string, pack: TextPack): void {
  loadedText = { locale, pack }
  for (const [id, value] of textObjects) applyPatch(value, locale, pack[id])
}

/** 水合前加载当前语言的字典；不是拆分语言时立即完成。加载失败时回退到基础语言文案，不阻断水合。 */
export async function loadSplitMessages(locale: string): Promise<void> {
  const load = loaders[locale]
  if (!load || loaded?.locale === locale) return
  try {
    // 字典分包求值时已调用 installTextPack 写入该语言的文案表补丁
    loaded = { locale, dictionary: (await load()).default }
  } catch {
    // 网络失败时界面以基础语言显示，与服务端输出不同处由 React 在水合时修正
  }
}
