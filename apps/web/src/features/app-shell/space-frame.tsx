import type { ReactNode } from 'react'

/**
 * 空间内页的统一框架：标题与说明在上，下面是若干面板（见 docs/design/visual-system.md「布局与组件」）。
 * 只负责外观与结构，内容与数据读取仍由各页面自己处理。
 */
export function SpacePage({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-line border-b pb-5">
        <div className="grid min-w-0 gap-2">
          <h1 className="m-0 font-heading font-bold text-3xl text-ink leading-tight sm:text-[34px]">
            {title}
          </h1>
          {description ? (
            <p className="m-0 max-w-2xl text-ink-muted leading-relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}

/** 空间内页的面板：圆角卡片，标题可选 */
export function SpacePanel({
  title,
  children,
  className = '',
}: {
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`grid min-w-0 gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6 ${className}`}
    >
      {title ? <h2 className="m-0 font-semibold text-ink text-lg">{title}</h2> : null}
      {children}
    </section>
  )
}

/**
 * 空间的导航分区是否显示，按站点功能开关与成员角色决定。
 * 概览与设置始终显示；对话另需空间有可用模型，其余与原导航保持相同条件，只是集中在一处。
 */
export function spaceSections(options: {
  billing: boolean
  credits: boolean
  textAi: boolean
  /** 当前空间至少有一个可用文本模型（getChatAvailable）；没有时不显示对话入口 */
  chatAvailable: boolean
  mediaAi: boolean
  publicApi: boolean
  canManageKeys: boolean
}) {
  return {
    readings: options.billing && options.textAi,
    chat: options.textAi && options.chatAvailable,
    tasks: options.mediaAi,
    media: options.mediaAi,
    usage: options.credits,
    billing: options.billing,
    apiKeys: options.billing && options.publicApi && options.canManageKeys,
  }
}
