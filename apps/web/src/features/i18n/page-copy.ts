import type { SpreadId } from '@xuanxue/tarot'
import type { StaticPath } from '../seo/metadata.ts'
import type { NumerologyToolId } from '../tools/numerology/routes.ts'

/**
 * 新语言页面的 SEO 文案（Title、description、首页标语）按语言拆分（openspec add-locales-eu-ja design 决策 11
 * 「首页脚本」，D-9 首页包预算不上调）。本文件归项目所有。
 *
 * v1 四种语言的这些文案写在各自模块里（metadata.ts staticCopy、home-copy.ts、塔罗与数字命理路由表），会进入每个
 * 首页的脚本闭包；新语言（es 起）改为每种语言一个数据模块 `page-copy/<语言>.ts`：
 * - 服务端、预渲染、构建脚本与单元测试：`page-copy.server.ts` 静态导入全部语言并登记，同步可用；
 * - 浏览器（生产构建）：随该语言的文案字典分包一起加载（scripts/locale-split.ts、split-messages.ts），水合前登记；
 *   其他语言的页面不下载。dev 不拆分文案，客户端入口直接导入 page-copy.server.ts。
 * 本模块不引用任何运行时模块（vite 配置加载工具注册表时也会引用到它），只保存登记表。
 */
export type SeoCopy = readonly [title: string, description: string]

export interface PageCopy {
  /** 语言首页：Title（含站名，pageHead 不再追加）、description、分享图标语（不含站名） */
  readonly home: readonly [title: string, description: string, tagline: string]
  /** metadata.ts 的静态页（首页取 home） */
  readonly static: Readonly<Record<Exclude<StaticPath, '/'>, SeoCopy>>
  /** 塔罗牌阵页（Title 不含站名） */
  readonly tarot: Readonly<Record<SpreadId, SeoCopy>>
  /** 牌义索引页 */
  readonly tarotIndex: SeoCopy
  /** 数字命理四个工具内页（西方站语言） */
  readonly numerologyTools?: Readonly<Record<NumerologyToolId, SeoCopy>>
}

const registry = new Map<string, PageCopy>()

/** 登记一种语言的页面文案（服务端静态登记，浏览器在加载后登记） */
export function registerPageCopy(locale: string, copy: PageCopy): void {
  registry.set(locale, copy)
}

/** 该语言已登记的页面文案；v1 语言与尚未加载时为 undefined，调用方回退到各模块内的文案 */
export function pageCopy(locale: string): PageCopy | undefined {
  return registry.get(locale)
}
