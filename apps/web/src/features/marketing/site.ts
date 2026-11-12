import { useRouterState } from '@tanstack/react-router'
import { templateConfig } from '../../server/template-config.ts'

/**
 * 营销站在客户端也要用到的模板配置（站点名称与功能开关）。只取公开字段，
 * 模板配置本身不含密钥（docs/02-project-structure.md §3）。
 */
export const site = {
  name: templateConfig.app.name,
  blog: templateConfig.features.blog,
  docs: templateConfig.features.docs,
  guides: templateConfig.features.guides,
  /** 营销区块（openspec add-ui-design-system 8.5）：背书数值、产品矩阵与悬浮 AI 入口均由模板配置驱动 */
  marketing: {
    stats: templateConfig.marketing.stats,
    steps: templateConfig.marketing.steps,
    products: templateConfig.marketing.products,
    // 悬浮入口指向 AI 功能，项目关闭文本 AI 时一并隐藏，避免指向不存在的功能
    aiEntry:
      templateConfig.marketing.enabled &&
      templateConfig.marketing.aiEntry.enabled &&
      templateConfig.ai.text.enabled
        ? templateConfig.marketing.aiEntry.href
        : null,
  },
} as const

const NO_LOCALES: readonly string[] = []

/**
 * 有已发布博客文章的语言（specs/marketing-site「博客为空时隐藏入口」）：根布局 loader 从构建期生成的
 * 内容集合统计（features/marketing/content.functions.ts 的 getBlogLocales），不查数据库。
 */
export function useBlogLocales(): readonly string[] {
  return useRouterState({
    select: (state) =>
      (state.matches[0]?.loaderData as { blogLocales?: readonly string[] } | undefined)
        ?.blogLocales ?? NO_LOCALES,
  })
}

/** 当前语言是否显示博客入口：功能开启且该语言自己有已发布文章（不计默认语言的回退文章） */
export function blogHasPosts(blogLocales: readonly string[], locale: string): boolean {
  return site.blog && blogLocales.includes(locale)
}
