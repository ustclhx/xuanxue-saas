import './security-client.ts'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { siteLocale } from './features/i18n/site-locale.ts'
import { loadSplitMessages } from './features/i18n/split-messages.ts'
import { getLocale, type Locale, overwriteGetLocale } from './paraglide/runtime.js'
import { templateConfig } from './server/template-config.ts'

// 水合与之后的链接生成都不使用外站语言（features/i18n/site-locale.ts）；须在渲染前替换。
const resolveLocale = getLocale
overwriteGetLocale(
  () => siteLocale(resolveLocale(), new URL(window.location.href), templateConfig) as Locale,
)

// 先配置 Zod，再加载含业务 schema 的路由图；静态 import 会先执行依赖中的 schema 初始化。
// 新语言页面同时加载该语言的文案字典与页面 SEO 文案（features/i18n/split-messages.ts、page-copy.ts），
// 水合前就绪；v1 语言不加载。dev 不拆分文案，页面 SEO 文案直接导入（生产构建中此分支被移除）
void Promise.all([
  import('@tanstack/react-start/client'),
  loadSplitMessages(getLocale()),
  import.meta.env.DEV ? import('./features/i18n/page-copy.server.ts') : undefined,
]).then(([{ StartClient }]) => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
})
