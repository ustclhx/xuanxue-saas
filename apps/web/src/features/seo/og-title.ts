/**
 * 构建期默认分享图的标题（2026-11-14 使用者确认「用短标题」）：模板版式的 hero 标题上限约 24 个加权字宽，
 * 页面 SEO 标题常带「：/ | / ｜ / ·」后的补充说明，整句放进分享图会被截断成「…: Free…」。
 * 分享图只取分隔符前的主标题；没有分隔符时原样返回。页面 <title> 与 og:title 不受影响。
 */
const SEPARATORS = [': ', ' | ', ' – ', ' — ', '：', '｜', ' · ']

export function ogImageTitle(title: string): string {
  let short = title
  for (const separator of SEPARATORS) {
    const index = short.indexOf(separator)
    if (index > 0) short = short.slice(0, index)
  }
  return short.trim() || title
}
