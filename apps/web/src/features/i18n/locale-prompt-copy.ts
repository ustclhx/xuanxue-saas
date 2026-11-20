/**
 * 语言建议提示的文案（设计稿 docs/design/prototypes/warm-refresh/LocalePromptSpec.dc.html「E · 文案」）。
 * 提示用目标语言书写（看不懂当前页的人也要看得懂），所以每个页面都要带本站各语言的这几条短文案；
 * 不放进 Paraglide：新语言的文案在客户端按语言拆分（locale-split.ts），当前页只加载本语言字典，取不到目标语言。
 * 区域名称沿用 i18n_suggestion_label 的现有译法；ko、ja、es 待母语审阅。
 */
export interface PromptCopy {
  /** 提示句 */
  readonly message: string
  /** 切换按钮的可见文字 */
  readonly switch: string
  /** 切换的可读名称（含可见文字） */
  readonly switchLabel: string
  /** 关闭的可读名称 */
  readonly dismiss: string
  /** 区域名称 */
  readonly region: string
}

export const PROMPT_COPY: Readonly<Record<string, PromptCopy>> = {
  en: {
    message: 'This page has an English version. Switch?',
    switch: 'Switch',
    switchLabel: 'Switch to English',
    dismiss: 'Dismiss',
    region: 'Language suggestion',
  },
  'zh-Hant': {
    message: '本頁有繁體中文版，要切換嗎？',
    switch: '切換',
    switchLabel: '切換到繁體中文',
    dismiss: '關閉',
    region: '語言建議',
  },
  'zh-Hans': {
    message: '本页有简体中文版，要切换吗？',
    switch: '切换',
    switchLabel: '切换到简体中文',
    dismiss: '关闭',
    region: '语言建议',
  },
  ko: {
    message: '이 페이지는 한국어로도 볼 수 있어요. 전환할까요?',
    switch: '전환',
    switchLabel: '한국어로 전환',
    dismiss: '닫기',
    region: '언어 추천',
  },
  ja: {
    message: 'このページには日本語版があります。切り替えますか？',
    switch: '切り替える',
    switchLabel: '日本語に切り替える',
    dismiss: '閉じる',
    region: '言語の提案',
  },
  es: {
    message: 'Hay una versión en español. ¿Cambiar?',
    switch: 'Cambiar',
    switchLabel: 'Cambiar a español',
    dismiss: 'Cerrar',
    region: 'Sugerencia de idioma',
  },
}

/** 浏览器语言为不带地区与书写系统的 `zh` 时并列简繁两个候选：提示句在两种写法里相同 */
export const CHINESE_PAIR_COPY = {
  message: '有中文版本',
  dismiss: '关闭',
  region: '语言建议',
  lang: 'zh',
} as const

/** 候选按钮的可见文字（语言自称） */
export const PROMPT_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
}
