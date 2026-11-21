import es from './page-copy/es.ts'
import { registerPageCopy } from './page-copy.ts'

/**
 * 服务端、预渲染、构建脚本与单元测试：静态登记全部语言的页面 SEO 文案（page-copy.ts），同步可用。
 * 由 src/server.ts、features/seo/pages.server.ts、scripts/og-images.ts 与单元测试的 setup 引用；不进浏览器包。
 */
registerPageCopy('es', es)
