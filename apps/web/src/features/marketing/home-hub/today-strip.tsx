import type { SiteId } from '@xuanxue/config'
import { Section } from '@xuanxue/ui/project'
import { type ReactNode, useEffect, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { browserDate, type CivilDate, formatLongDate } from '../../daily/date.ts'
import { publicDayPillar, publicUniversalDay } from '../../daily/public-day.ts'
import { BRANCH_HANGUL, BRANCH_HANZI, STEM_HANGUL, STEM_HANZI } from '../../tools/bazi/glyphs.ts'

/** 今日条第二行：东方站当日干支（韩语加读音），西方站 Universal Day */
export function todayHeadline(site: SiteId, date: CivilDate): string {
  if (site === 'west') return m.daily_west_universal({ value: publicUniversalDay(date) })
  const { stem, branch } = publicDayPillar(date)
  return m.landing_today_pillar({
    pillar: `${STEM_HANZI[stem]}${BRANCH_HANZI[branch]}`,
    reading: `${STEM_HANGUL[stem]}${BRANCH_HANGUL[branch]}`,
  })
}

/**
 * 一行文字或它的骨架。骨架内放一个不换行空格，行高由同一个字号角色决定，
 * 填入文字前后这一行的高度相同；灰条绝对定位，不参与排版。
 */
function Line({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`block whitespace-nowrap ${className}`}>
      {children ?? (
        <span data-today-skeleton aria-hidden="true" className="relative inline-block w-40">
          {' '}
          <span className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-field bg-line-strong" />
        </span>
      )}
    </span>
  )
}

/**
 * 今日条（openspec separate-landing-homepage design.md D6，home-hub「每日运势入口」；设计稿 warm-refresh 的 band）：
 * 预渲染的首页是静态 HTML，不能在构建期写入「今日」。服务端只输出固定尺寸的骨架与链接文字，
 * 水合后在 effect 中取访客本地日期，在浏览器内算出当日干支 / Universal Day 并填入；渲染时不读 Date，
 * 服务端与客户端首帧一致。宜忌等需要历表的内容只在每日运势页显示，首页不计算个人运势。
 * 每日运势页未登记时由调用方不渲染本组件。
 */
export function TodayStrip({ site, href }: { site: SiteId; href: string }) {
  const locale = getLocale()
  const [today, setToday] = useState<CivilDate | null>(null)
  useEffect(() => setToday(browserDate()), [])
  return (
    <Section
      id="today"
      tone="band"
      aria-label={m.landing_today_label()}
      data-landing-block="today"
      data-today={today ? 'ready' : 'pending'}
    >
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-5">
        <Line className="text-caption text-ink-subtle">
          {today && m.landing_today_date({ date: formatLongDate(today, locale) })}
        </Line>
        <Line className="font-heading text-ink text-subtitle">
          {today && todayHeadline(site, today)}
        </Line>
      </div>
      <a
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center text-body text-brand-ink hover:decoration-2"
      >
        {m.home_hub_daily_cta()}
      </a>
    </Section>
  )
}
