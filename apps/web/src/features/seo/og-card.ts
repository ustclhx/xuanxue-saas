import { createElement } from 'react'
/** 构建卡片直接使用内容标题，完整字体不进入 Worker 包。品牌与域名按页面所属站点传入。 */
export function OgCard({ title, brand, host }: { title: string; brand: string; host: string }) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 72,
        color: '#f8fafc',
        background: 'linear-gradient(135deg, #0f172a, #312e81)',
        fontFamily: 'Noto Sans SC, Noto Sans KR',
      },
    },
    createElement('div', { style: { display: 'flex', fontSize: 36 } }, brand),
    createElement(
      'div',
      { style: { display: 'flex', fontSize: 64, lineHeight: 1.25, overflow: 'hidden' } },
      title,
    ),
    createElement('div', { style: { display: 'flex', fontSize: 24, color: '#c7d2fe' } }, host),
  )
}
