import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// 图形的静态渲染（tasks 3.1）：服务端渲染测试、构建期 OG（design D6）与分享图套框都用它得到 SVG 字符串。
// React 的 useId 在静态渲染中输出稳定的 id，相同输入得到相同标记，可直接做快照或结构对比。
export function renderChartMarkup(element: ReactElement): string {
  return renderToStaticMarkup(element)
}

/** 作为 <img src> / satori 图片嵌入的 SVG data URI */
export function svgDataUri(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}
