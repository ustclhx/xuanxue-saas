import type { SiteId } from '@xuanxue/config'

// 结果分享图的数据模型（openspec redesign-home-chart-visuals tasks 7.2，「分享图」画布 ShareCard.dc.html）。
// 结果页把已经算好的结果整理成这里的结构交给分享图模块；模型只含要画在图里的文字与图形，
// 姓名、邮箱、出生地从不进入模型；出生日期单独放在 birth，只有访客勾选时才画出（share-cards「分享图内容与隐私」）。
// 本文件与 sources.ts 会进入结果页的静态包，不能引用分享图的布局与绘制代码（那些只经 import() 加载）。

export type ShareCardTool = 'bazi' | 'manseryeok' | 'ziwei' | 'life-path'

/** 四柱的一柱：柱名、天干地支（汉字）、可选的韩文读音；时辰未知时 stem / branch 为 null */
export interface ShareCardPillar {
  label: string
  stem: string | null
  branch: string | null
  /** 韩语页在汉字下方写读音，如「경」 */
  stemReading?: string | undefined
  branchReading?: string | undefined
  /** 日柱反色（与页面四柱图一致） */
  day: boolean
}

export type ShareCardBody =
  | { kind: 'pillars'; pillars: ShareCardPillar[] }
  | { kind: 'life-path'; value: number; master: string | null }
  /** 克隆页面中已渲染的图形节点（`svg[data-chart=<chart>]`），如紫微十二宫 */
  | { kind: 'chart'; chart: string }

export interface ShareCardModel {
  tool: ShareCardTool
  site: SiteId
  /** 卡片标题，如「干支日 · 我的八字」「Arcanumber」 */
  title: string
  /** 标题下方的小字（西方站「MY LIFE PATH」），东方站为空 */
  eyebrow: string | null
  /** 规范域名，如 ganjiday.com */
  domain: string
  body: ShareCardBody
  /** 结论标题，如「日主庚金 · 身強」「Expression」 */
  headline: string
  /** 一句结论，来自现有结果文字 */
  line: string
  /** 出生日期（与时间）；只有访客勾选「显示出生日期」时才画出 */
  birth: string
  /** 页脚左侧：免费排盘 + 网址 */
  cta: string
  /** 页脚右侧：隐私说明，随是否含出生日期变化 */
  privacy: { withBirth: string; withoutBirth: string }
  /** 当前语言的合规声明（免费结果：依传统规则计算、仅供娱乐、不预测未来） */
  disclaimer: string
  /** 下载文件名（不含扩展名），不含任何输入 */
  fileName: string
}

export interface ShareCardOptions {
  includeBirth: boolean
}
