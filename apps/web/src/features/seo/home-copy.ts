// 首页 SEO 文案（标题、描述）：staticPage('/') 与分享卡片默认分享图副标题共用。
// 独立成小模块，分享卡片版式只依赖这里，不把 metadata.ts 拉进分享卡片的服务端模块图。
// 项目文案（模板 0.4.1 升级说明：改过首页标题的项目在本文件保留自己的文案）：
// 东方站三种语言描述八字、紫微、塔罗等本站体系，西方站英文描述数字命理与塔罗。
const HOME_COPY: Readonly<Record<string, readonly [title: string, description: string]>> = {
  en: [
    'Free numerology and tarot tools',
    'Life Path, numerology chart, name numerology and tarot spreads, calculated by traditional rules in your browser. For entertainment and self-reflection.',
  ],
  'zh-Hant': [
    '八字排盤、紫微斗數與塔羅',
    '免費八字排盤、紫微斗數與塔羅工具，依傳統規則在瀏覽器中計算，僅供娛樂與自我反思。',
  ],
  'zh-Hans': [
    '八字排盘、紫微斗数与塔罗',
    '免费八字排盘、紫微斗数与塔罗工具，依传统规则在浏览器中计算，仅供娱乐与自我反思。',
  ],
  ko: [
    '무료 만세력·사주·타로',
    '무료 만세력, 사주궁합, 타로 도구. 전통 규칙에 따라 브라우저에서 계산하며 오락과 자기 성찰용입니다.',
  ],
}

/** 未登记的语言回退到英文（西方站）文案 */
export function homePageCopy(locale: string): [title: string, description: string] {
  const [title, description] = HOME_COPY[locale] ?? HOME_COPY.en ?? ['', '']
  return [title, description]
}
