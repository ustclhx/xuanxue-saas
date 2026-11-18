import { cn } from '@xuanxue/ui'

/** 十天干沿半径 99 的圆周等分排列，从正上方顺时针（设计稿 Main.dc.html 的坐标） */
const STEMS = [
  ['甲', 140, 41],
  ['乙', 198.2, 59.9],
  ['丙', 234.2, 109.4],
  ['丁', 234.2, 170.6],
  ['戊', 198.2, 220.1],
  ['己', 140, 239],
  ['庚', 81.8, 220.1],
  ['辛', 45.8, 170.6],
  ['壬', 45.8, 109.4],
  ['癸', 81.8, 59.9],
] as const

/**
 * 东方站母题「天干轮」（refresh-visual-system-warm D8）：中性灰线描的双环与十天干，松绿印章是唯一的强调。
 * 颜色只来自外层 token 工具类（线条 text-illus，印章 mark / on-mark），随主题切换；装饰图对读屏隐藏。
 * 宽高比固定为 1:1，尺寸由调用方用宽度类决定，不引起布局位移。
 */
export function StemWheel({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      aria-hidden="true"
      focusable="false"
      className={cn('block aspect-square text-illus', className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
        <circle cx="140" cy="140" r="112" />
        <circle cx="140" cy="140" r="86" opacity="0.55" />
        <path d="M48 196C90 250 200 252 236 180" />
      </g>
      <g
        fill="currentColor"
        fontSize="15"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-heading"
      >
        {STEMS.map(([stem, x, y]) => (
          <text key={stem} x={x} y={y}>
            {stem}
          </text>
        ))}
      </g>
      <rect x="176" y="176" width="52" height="52" rx="4" className="fill-mark" />
      <g fontSize="14" textAnchor="middle" className="fill-on-mark font-heading">
        <text x="202" y="198">
          干支
        </text>
        <text x="202" y="218">
          日
        </text>
      </g>
    </svg>
  )
}
