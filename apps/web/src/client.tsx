import './security-client.ts'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { siteLocale } from './features/i18n/site-locale.ts'
import { getLocale, type Locale, overwriteGetLocale } from './paraglide/runtime.js'
import { templateConfig } from './server/template-config.ts'

// 水合与之后的链接生成都不使用外站语言（features/i18n/site-locale.ts）；须在渲染前替换。
const resolveLocale = getLocale
overwriteGetLocale(
  () => siteLocale(resolveLocale(), new URL(window.location.href), templateConfig) as Locale,
)

// 先配置 Zod，再加载含业务 schema 的路由图；静态 import 会先执行依赖中的 schema 初始化。
void import('@tanstack/react-start/client').then(({ StartClient }) => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
})
