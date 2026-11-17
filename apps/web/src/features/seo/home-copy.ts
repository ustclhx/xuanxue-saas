// 首页 SEO 文案（标题、描述）与默认分享图副标题：staticPage('/') 与分享卡片共用。
// 独立成小模块，分享卡片版式只依赖这里，不把 metadata.ts 拉进分享卡片的服务端模块图。
// 项目文案（模板 0.4.1 升级说明：改过首页标题的项目在本文件保留自己的文案）：
// 东方站三种语言描述八字、紫微、塔罗等本站体系，西方站英文描述数字命理与塔罗。
// 标题为品牌名在前加品类主词（openspec separate-landing-homepage design.md D3，使用者 2026-11-17 确认）：
// 首页是品牌落地页，工具主词由各主工具页承接；pageHead 见到标题已含站名，不再追加（D3a）。
// 分享图副标题与品牌名并排显示（「品牌名 · 标语」），因此单独保留不含品牌名的标语。
const HOME_COPY: Readonly<
  Record<string, readonly [title: string, description: string, tagline: string]>
> = {
  en: [
    'Arcanumber — Free Life Path Number Calculator, Numerology & Tarot',
    'Life Path, numerology chart, name numerology and tarot spreads, calculated by traditional rules in your browser. For reference and self-reflection.',
    'Free numerology and tarot tools',
  ],
  'zh-Hant': [
    '干支日｜免費八字排盤、紫微斗數與塔羅',
    '免費八字排盤、紫微斗數與塔羅工具，依傳統規則在瀏覽器中計算，僅供參考與潛意識探索。',
    '八字排盤、紫微斗數與塔羅',
  ],
  'zh-Hans': [
    '干支日｜免费八字排盘、紫微斗数与塔罗',
    '免费八字排盘、紫微斗数与塔罗工具，依传统规则在浏览器中计算，仅供参考与潜意识探索。',
    '八字排盘、紫微斗数与塔罗',
  ],
  ko: [
    '간지데이 | 무료 만세력·사주·타로',
    '무료 만세력, 사주궁합, 타로 도구. 전통 규칙에 따라 브라우저에서 계산하며 참고와 자기 탐색용입니다.',
    '무료 만세력·사주·타로',
  ],
}

const copyOf = (locale: string) => HOME_COPY[locale] ?? HOME_COPY.en ?? ['', '', '']

/** 未登记的语言回退到英文（西方站）文案 */
export function homePageCopy(locale: string): [title: string, description: string] {
  const [title, description] = copyOf(locale)
  return [title, description]
}

/** 默认分享图副标题中的标语（不含品牌名）；未登记的语言回退到英文 */
export function homeTagline(locale: string): string {
  return copyOf(locale)[2]
}
