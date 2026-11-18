import { PageWidth } from '@xuanxue/ui/project'
import type { ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'

/** 首屏次要链接与样例报告区块共用的锚点 */
export const SAMPLE_ANCHOR = 'sample'

/**
 * 品牌主视觉（openspec separate-landing-homepage design.md D2、D2a；设计稿 warm-refresh/Main.dc.html、
 * LandingWest.dc.html）：H1 品牌承诺、一句副标题、唯一的主按钮（指向本语言主工具页，锚文本含工具关键词）、
 * 一个页内文字链接与一行证明。首屏只有一个主任务，文案不写 AI。
 * 插画位固定尺寸（手机 168px 在标题上方，桌面 320px 在标题右侧）并对读屏隐藏：
 * 插画（features/illustrations/）由首页路由按站点传入并填满插画位，是否传入都不改变布局。
 */
export function LandingHero({ toolHref, art }: { toolHref: string; art?: ReactNode }) {
  return (
    <section aria-labelledby="landing-title" data-landing-block="hero">
      <PageWidth className="flex flex-col-reverse gap-6 pt-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pt-18">
        <div className="flex max-w-150 flex-col gap-4 lg:gap-5">
          <h1 id="landing-title" className="m-0 text-balance font-heading text-display text-ink">
            {m.landing_h1()}
          </h1>
          <p className="m-0 text-ink-muted text-lead">{m.landing_subtitle()}</p>
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <a
              href={toolHref}
              data-landing-cta
              className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-brand px-7 font-medium text-body text-on-brand no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3"
            >
              {m.landing_cta()}
            </a>
            <a
              href={`#${SAMPLE_ANCHOR}`}
              className="inline-flex min-h-11 items-center justify-center text-body text-brand-ink hover:decoration-2"
            >
              {m.landing_sample_link()}
            </a>
          </div>
          <p role="note" className="m-0 text-center text-caption text-ink-subtle sm:text-left">
            {m.landing_proof()}
          </p>
        </div>
        <div
          aria-hidden="true"
          data-landing-art
          className="size-42 shrink-0 self-center lg:size-80"
        >
          {art}
        </div>
      </PageWidth>
    </section>
  )
}
