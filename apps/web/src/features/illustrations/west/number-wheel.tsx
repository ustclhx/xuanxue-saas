import { cn } from '@xuanxue/ui'

/** 数字 1–9 沿半径 88 的圆周等分排列，从正上方顺时针（设计稿 LandingWest.dc.html 的坐标） */
const DIGITS = [
  [1, 140, 52],
  [2, 196.6, 72.6],
  [3, 226.7, 124.7],
  [4, 216.2, 184],
  [5, 170.1, 222.7],
  [6, 109.9, 222.7],
  [7, 63.8, 184],
  [8, 53.3, 124.7],
  [9, 83.4, 72.6],
] as const

/**
 * 西方站母题「数字轮」（refresh-visual-system-warm D8）：中性灰线描的双环与数字 1–9，黄铜四芒星是唯一的强调。
 * 颜色只来自外层 token 工具类（线条 text-illus，星 stroke-mark），随主题切换；装饰图对读屏隐藏。
 * 宽高比固定为 1:1，尺寸由调用方用宽度类决定，不引起布局位移。
 */
export function NumberWheel({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      aria-hidden="true"
      focusable="false"
      className={cn('block aspect-square text-illus', className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
        <circle cx="140" cy="140" r="112" />
        <circle cx="140" cy="140" r="64" opacity="0.55" />
      </g>
      <g
        fill="currentColor"
        fontSize="18"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-heading"
      >
        {DIGITS.map(([digit, x, y]) => (
          <text key={digit} x={x} y={y}>
            {digit}
          </text>
        ))}
      </g>
      <path
        d="M140 104l8 28 28 8-28 8-8 28-8-28-28-8 28-8z"
        fill="none"
        strokeWidth="1.25"
        strokeLinejoin="round"
        className="stroke-mark"
      />
    </svg>
  )
}
