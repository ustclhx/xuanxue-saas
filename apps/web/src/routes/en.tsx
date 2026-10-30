import { createFileRoute } from '@tanstack/react-router'
import { eastEnglishHead } from '../features/marketing/east-english/head.ts'
import { EastEnglishPage } from '../features/marketing/east-english/page.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'

// 东方站英文入口页（openspec product-improve-ai-content-20261030 tasks.md 4.8，D5）。
// 只在东方站可达：西方站与预览地址的 `/en` 由站点守卫 307 到无前缀首页（features/site/gate.ts），
// 东方站其他 `/en/*` 返回 404。静态文案，构建期预渲染（features/marketing/prerender.ts）。
export const Route = createFileRoute('/en')({
  head: () => eastEnglishHead(),
  component: () => (
    <MarketingShell>
      <EastEnglishPage />
    </MarketingShell>
  ),
})
