import { m } from '../../../paraglide/messages.js'
import { WEST_SAMPLE } from './sample.ts'

/**
 * 西方站首页样例（设计稿 warm-refresh/LandingWest.dc.html「Sample chart」）：虚构生日 1990-05-15 的
 * Life Path 3 数字环与两项核心数字。数值固化在 sample.ts（landing-page.test.tsx 与数字命理包对拍），
 * 静态预渲染，不加载数字命理计算代码。
 */
export function WestSampleChart() {
  return (
    <div
      data-sample-chart="life-path"
      className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7"
    >
      <svg
        viewBox="0 0 132 132"
        role="img"
        aria-label={m.landing_sample_number_label({ value: WEST_SAMPLE.lifePath })}
        className="size-33 shrink-0 text-illus"
      >
        <circle cx="66" cy="66" r="62" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <circle
          cx="66"
          cy="66"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="opacity-55"
        />
        <text
          x="66"
          y="68"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink font-heading text-display"
        >
          {WEST_SAMPLE.lifePath}
        </text>
      </svg>
      <dl className="m-0 flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-ink-subtle">{m.landing_sample_life_path_label()}</dt>
          <dd className="m-0 text-body text-ink">
            {m.landing_sample_life_path_value({ value: WEST_SAMPLE.lifePath })}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-ink-subtle">{m.landing_sample_birthday_label()}</dt>
          <dd className="m-0 text-body text-ink">
            {m.landing_sample_birthday_value({ value: WEST_SAMPLE.birthday })}
          </dd>
        </div>
      </dl>
    </div>
  )
}
