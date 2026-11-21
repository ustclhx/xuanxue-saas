import type { SpreadId, Suit } from '@xuanxue/tarot'

/**
 * 东方站根路径英文的正文类型（openspec add-locales-eu-ja 5b）。
 *
 * 站点作用域的英文文案层：Paraglide 只有一套 `en`（西方站英文与两站共用的界面文案）。东方站英文页面的正文
 * （落地页、八字与紫微的说明与 FAQ、牌阵页说明、as feelings 牌页的界面词、FAQ 页）放在本目录的 TS 模块里，
 * 只由东方站英文的页面组件引用，不进西方站与其他语言页面的包，也不进各语言首页的水合闭包。
 * 东方站独有工具的界面词（八字、紫微的表单与结果标签）没有西方站对应，仍走 Paraglide `messages/en/*.json`。
 *
 * 正文中的链接写作 `[锚文本](目标键)`，目标键见 `LinkKey`；锚文本须是术语表
 * `apps/web/i18n/glossary/en-east.json` 中该目标登记的写法（每个目标 ≤2 种）。
 */
export type LinkKey =
  | 'home'
  | 'bazi'
  | 'ziwei'
  | 'spreads'
  | 'one-card'
  | 'pick-a-card'
  | 'celtic-cross'
  | 'feelings'
  | 'faq'
  | 'pricing'
  | 'privacy'
  | 'refund'

export interface Faq {
  readonly q: string
  readonly a: string
  /** local：取自英语用户的真实问法（自动补全、PAA、Reddit）；adapted：其余 */
  readonly origin: 'local' | 'adapted'
}

export interface TextSection {
  readonly heading: string
  /** 段落，可含 `[锚文本](目标键)` */
  readonly paragraphs: readonly string[]
}

export interface PageSeo {
  /** 不含站名（pageHead 追加「 | Ganjiday」），拉丁字母 ≤49 字符 */
  readonly title: string
  /** 120–155 字符 */
  readonly description: string
}

export interface LandingCopy extends PageSeo {
  readonly eyebrow: string
  readonly h1: string
  readonly lead: string
  /** 主按钮（指向八字计算器） */
  readonly cta: string
  readonly toolsTitle: string
  readonly toolsIntro: string
  readonly tools: Readonly<
    Record<
      'bazi' | 'ziwei' | 'spreads' | 'feelings',
      { title: string; summary: string; action: string }
    >
  >
  readonly sections: readonly TextSection[]
  readonly faqTitle: string
  readonly faq: readonly Faq[]
}

/** 八字 / 紫微工具页：表单与结果用 Paraglide 界面词，以下为页面正文 */
export interface ToolCopy extends PageSeo {
  /** 面包屑与导航名（主词） */
  readonly nav: string
  readonly h1: string
  readonly intro: string
  readonly submit: string
  readonly articleTitle: string
  readonly sections: readonly TextSection[]
  readonly faq: readonly Faq[]
}

export interface SpreadCopy {
  readonly h1: string
  readonly intro: string
  /** 导语后的一句，含 `[tarot cards as feelings](feelings)` 一类链接 */
  readonly feelingsNote: string
  /** 6 条示例问题（问题框的模板） */
  readonly templates: readonly string[]
  readonly positionsTitle: string
  /** 每个牌位的说明（名称与 packages/tarot 的英文牌位名一致，顺序相同） */
  readonly positions: readonly string[]
  readonly sections: readonly TextSection[]
  readonly moreTitle: string
  /** 其他三个牌阵各一句，句中 `[锚文本](目标键)` */
  readonly more: Readonly<Partial<Record<SpreadId, string>>>
  readonly faq: readonly Faq[]
}

export interface FeelingsIndexCopy extends PageSeo {
  readonly nav: string
  readonly h1: string
  readonly intro: string
  /** 每组：标题、一行说明，以及这一组牌「作为感受」时的读法（2–3 句，分组列表之前） */
  readonly groups: Readonly<Record<Suit, { title: string; note: string; about: string }>>
}

/** as feelings 牌页的固定界面词；`{name}` 为牌名 */
export interface FeelingsCardCopy {
  readonly crumb: string
  readonly facts: { group: string; keywords: string; yesNo: string }
  readonly tryTitle: string
  readonly tryIntro: string
  readonly drawLabel: string
  readonly cardLink: string
  readonly relatedTitle: string
  readonly relatedIntroMajor: string
  readonly relatedIntroMinor: string
  readonly related: {
    before: string
    after: string
    after2: string
    pairMajor: string
    pairMinor: string
  }
  readonly band: string
  readonly bandLabel: string
  readonly faqTitle: string
  readonly note: string
}

export interface FaqPageCopy {
  readonly h1: string
  readonly intro: string
  /** 「计算方法」一组（八字、紫微与塔罗），替代西方站的数字命理问答；积分、隐私、账号组沿用两站共用文案 */
  readonly methodsTitle: string
  readonly methods: readonly Faq[]
  /**
   * 积分与付款、隐私与账号两组：东方站英文自己的写法（事实与两站共用的定价规则一致：退款期限、积分有效期、
   * 每日积分），不复用西方站英文的问答文字（跨站同类页相似度门槛）
   */
  readonly sections: readonly { readonly title: string; readonly items: readonly Faq[] }[]
}
