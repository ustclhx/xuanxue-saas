import { type PageCopy, registerPageCopy } from './page-copy.ts'

/**
 * 新语言文案的按需字典（openspec add-locales-eu-ja tasks 1.6，构建插件见 scripts/locale-split.ts）。本文件归项目所有。
 *
 * 客户端构建中，拆分语言（v1 之后的新语言）的文案函数不在各文案模块里，而在每种语言一个的字典分包中；
 * 文案模块按序号调用 `splitMessage` 取函数，取不到时回退到基础语言（与 Paraglide 缺失文案的回退相同）。
 * 客户端入口在水合前调用 `loadSplitMessages(当前语言)`；v1 语言与 dev 环境下加载器表为空，什么都不做。
 * 服务端不使用本文件（服务端构建不拆分）。
 */
type Message = (inputs: unknown) => string
type Dictionary = Readonly<Record<number, Message>>
type Loaders = Readonly<Record<string, () => Promise<{ default: Dictionary; pageCopy?: PageCopy }>>>

// 构建时由 scripts/locale-split.ts 替换为各拆分语言的 import()；dev 与未配置新语言时为空
const loaders: Loaders = {}

let loaded: { locale: string; dictionary: Dictionary } | null = null

/** 文案模块调用：当前已加载字典中该序号的函数；没有时返回基础语言的函数 `fallback` */
export function splitMessage(locale: string, index: number, fallback: Message): Message {
  return (loaded?.locale === locale && loaded.dictionary[index]) || fallback
}

/** 水合前加载当前语言的字典；不是拆分语言时立即完成。加载失败时回退到基础语言文案，不阻断水合。 */
export async function loadSplitMessages(locale: string): Promise<void> {
  const load = loaders[locale]
  if (!load || loaded?.locale === locale) return
  try {
    const chunk = await load()
    loaded = { locale, dictionary: chunk.default }
    // 字典分包同时带该语言的页面 SEO 文案（scripts/locale-split.ts dictionarySource）
    if (chunk.pageCopy) registerPageCopy(locale, chunk.pageCopy)
  } catch {
    // 网络失败时界面以基础语言显示，与服务端输出不同处由 React 在水合时修正
  }
}
