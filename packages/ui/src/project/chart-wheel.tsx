import { cn } from '../lib/utils.ts'

// 星盘图（设计稿 docs/design/prototypes/content-growth-v2-batch2/Wheel.dc.html，使用者 2026-11-24 确认的 A2）：
// 外圈黄道十二星座、内圈十二宫，上升点固定在左侧、逆时针排列；行星字形按黄经放在星座圈内侧，
// 过密时沿黄道顺推并用引线指回实际位置；圆心内的相位线以实线（合、六分、三分）与虚线（四分、对分）区分，不靠色相。
// 只接收数值与已本地化的文字，不依赖星历引擎；图形是装饰性的摘要，页面须另给出同内容的表格（role="img" + aria-describedby）。

export interface ChartWheelPoint {
  /** 稳定 key（React key 与相位端点） */
  key: string
  /** 字形（如 ☉），建议带 U+FE0E 以文字样式显示 */
  glyph: string
  /** 回归黄道黄经（度） */
  longitude: number
}

export interface ChartWheelAspect {
  a: string
  b: string
  /** 四分、对分等「硬」相位画虚线 */
  hard: boolean
}

export interface ChartWheelProps {
  /** 上升点黄经：画在左侧（9 点钟方向） */
  ascendant: number
  /** 天顶黄经；整宫制时天顶不一定在第十宫宫头。 */
  midheaven: number
  /** 第 1–12 宫宫头黄经 */
  cusps: readonly number[]
  points: readonly ChartWheelPoint[]
  aspects: readonly ChartWheelAspect[]
  /** 十二星座字形，白羊起 */
  signGlyphs: readonly string[]
  /** 四个轴点的缩写：上升、天底、下降、天顶 */
  axisLabels: readonly [string, string, string, string]
  /** 图形的可访问名称 */
  label: string
  /** 同内容表格的 id（aria-describedby） */
  describedBy?: string
  className?: string
}

const C = 260
const R_OUTER = 250
const R_SIGN = 228
const R_INNER = 206
const R_PLANET = 178
const R_CORE = 110
// 字形之间的最小黄经间隔（度），按 18px 字号与 178 半径估算
const MIN_GAP = 10

const round = (value: number) => Math.round(value * 10) / 10
const norm = (value: number) => ((value % 360) + 360) % 360

function point(longitude: number, radius: number, ascendant: number) {
  const angle = ((180 + longitude - ascendant) * Math.PI) / 180
  return { x: round(C + radius * Math.cos(angle)), y: round(C - radius * Math.sin(angle)) }
}

/** 过密的字形沿黄道顺推，至少相隔 MIN_GAP 度；从最大空隙之后开始排，避免首尾在 0° 处相撞 */
function spread(points: readonly ChartWheelPoint[]): { point: ChartWheelPoint; shown: number }[] {
  const sorted = [...points].sort((a, b) => norm(a.longitude) - norm(b.longitude))
  if (sorted.length === 0) return []
  let start = 0
  let widest = -1
  for (let i = 0; i < sorted.length; i++) {
    const current = norm((sorted[i] as ChartWheelPoint).longitude)
    const previous = norm(
      (sorted[(i - 1 + sorted.length) % sorted.length] as ChartWheelPoint).longitude,
    )
    const gap = norm(current - previous) || (sorted.length === 1 ? 360 : 0)
    if (gap > widest) {
      widest = gap
      start = i
    }
  }
  const ordered = [...sorted.slice(start), ...sorted.slice(0, start)]
  const base = norm((ordered[0] as ChartWheelPoint).longitude)
  let previous = Number.NEGATIVE_INFINITY
  return ordered.map((item) => {
    // 相对首个字形的展开黄经，单调递增
    const unwrapped = base + norm(item.longitude - base)
    const shown = Math.max(unwrapped, previous + MIN_GAP)
    previous = shown
    return { point: item, shown }
  })
}

export function ChartWheel({
  ascendant,
  midheaven,
  cusps,
  points,
  aspects,
  signGlyphs,
  axisLabels,
  label,
  describedBy,
  className,
}: ChartWheelProps) {
  const at = (longitude: number, radius: number) => point(longitude, radius, ascendant)
  const byKey = new Map(points.map((item) => [item.key, item]))
  const placed = spread(points)
  const axes = [ascendant, midheaven + 180, ascendant + 180, midheaven]
  return (
    <svg
      viewBox="-44 -44 608 608"
      role="img"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn('mx-auto block aspect-square w-full max-w-130', className)}
    >
      <circle cx={C} cy={C} r={R_SIGN} fill="none" strokeWidth={44} className="stroke-surface-2" />
      {[R_OUTER, R_INNER, R_CORE].map((r) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          strokeWidth={1}
          className="stroke-line-strong"
        />
      ))}
      {signGlyphs.map((glyph, i) => {
        const a = at(i * 30, R_INNER)
        const b = at(i * 30, R_OUTER)
        const g = at(i * 30 + 15, R_SIGN)
        return (
          <g key={glyph}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={1}
              className="stroke-line-strong"
            />
            <text
              x={g.x}
              y={g.y}
              fontSize={17}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-ink-muted font-heading"
            >
              {glyph}
            </text>
          </g>
        )
      })}
      {cusps.map((cusp, i) => {
        const next = cusps[(i + 1) % cusps.length] ?? cusp
        const a = at(cusp, R_CORE)
        const b = at(cusp, R_INNER)
        const n = at(cusp + norm(next - cusp) / 2, R_CORE + 14)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 宫位序号即身份
          <g key={i}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={1}
              className="stroke-line-strong"
            />
            <text
              x={n.x}
              y={n.y}
              fontSize={11}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-ink-subtle"
            >
              {i + 1}
            </text>
          </g>
        )
      })}
      {axes.map((longitude, i) => {
        const text = axisLabels[i]
        const a = at(longitude, R_CORE)
        const b = at(longitude, R_OUTER)
        const q = at(longitude + 7, R_CORE - 16)
        return (
          <g key={text}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1.5} className="stroke-ink" />
            <text
              x={q.x}
              y={q.y}
              fontSize={12}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-mark font-heading"
            >
              {text}
            </text>
          </g>
        )
      })}
      {aspects.map((aspect) => {
        const pa = byKey.get(aspect.a)
        const pb = byKey.get(aspect.b)
        if (!pa || !pb) return null
        const a = at(pa.longitude, R_CORE)
        const b = at(pb.longitude, R_CORE)
        return (
          <line
            key={`${aspect.a}-${aspect.b}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            strokeWidth={1.25}
            strokeDasharray={aspect.hard ? '5 5' : undefined}
            className="stroke-illus"
          />
        )
      })}
      {placed.map(({ point: item, shown }) => {
        const dot = at(item.longitude, R_INNER)
        const lead1 = at(item.longitude, R_INNER - 5)
        const lead2 = at(shown, R_PLANET + 11)
        const glyph = at(shown, R_PLANET)
        return (
          <g key={item.key}>
            <circle cx={dot.x} cy={dot.y} r={2.5} className="fill-ink" />
            <line
              x1={lead1.x}
              y1={lead1.y}
              x2={lead2.x}
              y2={lead2.y}
              strokeWidth={1}
              className="stroke-ink-subtle"
            />
            <text
              x={glyph.x}
              y={glyph.y}
              fontSize={18}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-ink font-heading"
            >
              {item.glyph}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
