import type { AnnualRelationType } from '@xuanxue/bazi'

/**
 * 个人 2027 流年工具的正文与界面词（openspec content-growth-v2-tools 第 7 组；设计稿
 * content-growth-v2-tools/Liunian2027.dc.html）。四种语言各自撰写（zh-Hant 不是字形转换，ko 按韩语搜索词另写），
 * 由 loader 按页面语言动态导入，只有当前语言的文案进入页面数据。
 *
 * 十神、五行、柱名沿用 Paraglide `messages/<locale>/bazi.json`；这里只放本工具独有的文字。
 * 文案中的 `{name}` 为占位符，由 `fill()` 替换；数据只含字符串，可随 loader 序列化。
 */
export interface YearlyToolCopy {
  readonly seo: { readonly title: string; readonly description: string }
  /** 面包屑与内链区块里本页的名称（主词） */
  readonly crumb: string
  readonly h1: string
  readonly intro: string
  readonly submit: string
  readonly result: {
    readonly natalTitle: string
    readonly yearTitle: string
    /** 流年干支卡下的起止说明 */
    readonly yearSpan: string
    readonly yearLabel: string
    readonly tenGodTitle: string
    readonly tenGodLead: string
    readonly tenGodCols: readonly [string, string, string, string]
    readonly stemRow: string
    readonly branchRow: string
    /** 地支行的藏干说明：`{list}` 为「丁（正官）、乙（正财）」一类列表 */
    readonly hiddenNote: string
    readonly favorable: string
    readonly unfavorable: string
    readonly relTitle: string
    readonly relLead: string
    readonly relCols: readonly [string, string]
    readonly decadeLabel: string
    /** 大运行的补充：`{gz}` 为大运干支 */
    readonly decadeValue: string
    readonly decadeStart: string
    readonly noDecade: string
    readonly relTypes: Readonly<Record<AnnualRelationType, string>>
    readonly relNone: string
    readonly relSeparator: string
    readonly taiSuiTitle: string
    readonly taiSuiZhi: string
    readonly taiSuiChong: string
    readonly taiSuiNone: string
    readonly favorTitle: string
    readonly favorText: string
    readonly ruleNote: string
    /** 未填时辰时的近似说明（spec「不知道出生时辰」） */
    readonly approximate: string
    /** 详批按钮之前的一句：说明详批含流年逐年章节 */
    readonly unlockLead: string
  }
  readonly article: {
    readonly title: string
    readonly sections: readonly { readonly heading: string; readonly body: string }[]
  }
  readonly faq: readonly { readonly q: string; readonly a: string }[]
  readonly linksTitle: string
}

/** 把 `{key}` 换成对应值；未提供的键保持原样，便于测试发现遗漏 */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}
