import { cn } from '@xuanxue/ui'
import { type ReactNode, type SVGProps, useId } from 'react'
import type { Box, ChartSize } from './layout/geometry.ts'

// 图形外框与 SVG 基础元素（openspec redesign-home-chart-visuals design D3、tasks 3.1）。
// 约定：
// - 外框输出 `<svg viewBox>`，带 width/height 属性与 aspect-ratio，宽度随容器缩放、高度按比例确定，
//   水合、字体替换前后尺寸不变（chart-visuals「图形可在服务端渲染」）。
// - `role="img"` + `<title>`（必填，当前语言的图形名称与摘要）+ 可选 `<desc>`，以 aria-labelledby 关联；
//   完整的等价文字内容（表格 / 列表）由页面放在图形之后，不塞进 desc。
// - 颜色一律来自 colors.ts 的颜色槽，经 style 写入 fill / stroke，使 `var(--token)` 在页面中生效，
//   解析后的实际颜色在分享图与 OG 中同样可用。
// - 打印：类名 `chart-frame` 由 chart-print.css 在 @media print 下把 token 改为浅底深字；外框不跨页拆开。
// - 不依赖浏览器 API、网络或数据库，可在服务端、构建期与 OG 生成中用 renderToStaticMarkup 渲染。
// 具体视觉（字号、线宽、圆角、配色槽的选用）以设计稿为准，在各图形组件中决定。

export interface ChartFrameProps {
  /** viewBox 尺寸，决定宽高比 */
  size: ChartSize
  /** 图形的可读名称（读屏首先读到），应含摘要，如「四柱命盤：庚午年 辛巳月 庚辰日 辛巳時」 */
  title: string
  /** 可选的补充说明，例如「完整內容見下方表格」 */
  description?: string | undefined
  /** 图形类型标识，写入 data-chart，供测试、分享图克隆与打印样式定位 */
  name: string
  /** 背景色；省略时透明，沿用所在卡片的底色 */
  background?: string | undefined
  className?: string | undefined
  children: ReactNode
}

export function ChartFrame({
  size,
  title,
  description,
  name,
  background,
  className,
  children,
}: ChartFrameProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={size.width}
      height={size.height}
      role="img"
      aria-labelledby={description ? `${titleId} ${descId}` : titleId}
      data-chart={name}
      // cn 合并类名，调用方的 max-w-* 等可覆盖默认的 max-w-full
      className={cn('chart-frame block h-auto w-full max-w-full', className)}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      <title id={titleId}>{title}</title>
      {description ? <desc id={descId}>{description}</desc> : null}
      {background ? (
        <rect width={size.width} height={size.height} style={{ fill: background }} />
      ) : null}
      {children}
    </svg>
  )
}

/**
 * 图形文字字体：页面内沿用站点字体变量。分享图（SVG 作图片时读不到网页字体与 CSS 变量）与 OG
 * 在得到标记后把这两个值替换为系统字体栈或已嵌入的字体名。
 */
export const CHART_FONTS = {
  body: 'var(--site-font-body)',
  heading: 'var(--site-font-heading)',
} as const

type TextProps = Omit<SVGProps<SVGTextElement>, 'fill' | 'style'>

export interface ChartTextProps extends TextProps {
  /** 文字颜色（颜色槽的值） */
  color: string
  /** viewBox 坐标中的字号 */
  size: number
  /** 字体：正文 / 标题，分别对应站点的 --site-font-body / --site-font-heading */
  font?: 'body' | 'heading'
  weight?: number
  children: ReactNode
}

/** 图形中的文字：一律用 <text>，可被读屏与搜索读取，打印与缩放时保持清晰 */
export function ChartText({
  color,
  size,
  font = 'body',
  weight,
  children,
  ...props
}: ChartTextProps) {
  return (
    <text
      {...props}
      style={{
        fill: color,
        fontSize: size,
        fontFamily: CHART_FONTS[font],
        fontWeight: weight,
      }}
    >
      {children}
    </text>
  )
}

export interface ChartBoxProps {
  box: Box
  fill?: string
  stroke?: string
  strokeWidth?: number
  radius?: number
  /** 虚线描边，如时辰未知的占位格 */
  dashed?: boolean
}

/** 图形中的矩形格（柱、宫位、数字格）；颜色为空时不填充 / 不描边 */
export function ChartBox({
  box,
  fill,
  stroke,
  strokeWidth = 1,
  radius = 0,
  dashed,
}: ChartBoxProps) {
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      rx={radius || undefined}
      style={{
        fill: fill ?? 'none',
        stroke: stroke ?? 'none',
        strokeWidth: stroke ? strokeWidth : undefined,
        strokeDasharray: dashed ? `${strokeWidth * 4} ${strokeWidth * 3}` : undefined,
      }}
    />
  )
}

export interface ChartLineProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  stroke: string
  strokeWidth?: number
}

/** 连线（推导步骤、宫位分隔） */
export function ChartLine({ from, to, stroke, strokeWidth = 1 }: ChartLineProps) {
  return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} style={{ stroke, strokeWidth }} />
}
