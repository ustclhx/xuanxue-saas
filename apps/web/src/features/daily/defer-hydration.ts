/**
 * 每日页 SSR 的水合推迟到首帧之后（warm-lcp 修复）。
 *
 * 每日页不预渲染（design D7），构建期的 inline-critical-css 处理不到：SSR 输出的 HTML 带十个左右 modulepreload
 * 与水合入口，入口再静态引入约百个 chunk。它们与阻塞首绘的样式表同时下载，Lighthouse 模拟慢速 4G 时首帧被推到
 * 4.6–6.1 秒，且随实测首帧时刻前已发出的请求数波动。这里与预渲染页的 `hydration: 'after-paint'` 做同样的改写：
 * 去掉 modulepreload，水合入口由首帧后加载器插入；内联加载器沿用入口脚本的 nonce（缓存命中时按脚本哈希授权）。
 * 页面内容与样式不变。
 */

const MODULE_PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*\/?>/g
const MODULE_SCRIPT = /<script\b[^>]*\btype="module"[^>]*><\/script>/g
const SCRIPT_SRC = /\bsrc="(\/assets\/[^"]+\.js)"/
const NONCE = /\bnonce="([^"]*)"/

/**
 * 首帧后加载器：见到 first-contentful-paint 后（下一个任务中）插入水合入口；不支持 paint 观察时用 load 事件，
 * 最晚 3 秒兜底。与 scripts/marketing-html.mjs 的 afterPaintLoader 行为一致（每日页没有需要追加的样式表）。
 */
export function hydrationLoader(scripts: readonly string[], nonce?: string): string {
  const list = JSON.stringify(scripts).replace(/</g, '\\u003c')
  const attr = nonce ? ` nonce="${nonce}"` : ''
  return `<script${attr}>(function(){var d=document,done=0,js=${list};function run(){if(done)return;done=1;js.forEach(function(s){var e=d.createElement('script');e.type='module';e.src=s;d.head.appendChild(e)})}function soon(){setTimeout(run,0)}var P=window.PerformanceObserver;if(P&&P.supportedEntryTypes&&P.supportedEntryTypes.indexOf('paint')>=0){var o=new P(function(l){if(l.getEntriesByName('first-contentful-paint').length){o.disconnect();soon()}});o.observe({type:'paint',buffered:true})}else if(d.readyState==='complete')soon();else addEventListener('load',soon);setTimeout(run,3000)})()</script>`
}

/** 改写一份 SSR HTML；没有本站水合入口时原样返回 */
export function deferHydrationHtml(html: string): string {
  const scripts: string[] = []
  let nonce: string | undefined
  const out = html.replace(MODULE_SCRIPT, (tag) => {
    const src = tag.match(SCRIPT_SRC)?.[1]
    if (!src) return tag
    scripts.push(src)
    nonce ??= tag.match(NONCE)?.[1]
    return ''
  })
  if (scripts.length === 0) return html
  const loader = hydrationLoader(scripts, nonce)
  const result = out.replace(MODULE_PRELOAD, '')
  return /<\/body>/i.test(result)
    ? result.replace(/<\/body>/i, () => `${loader}</body>`)
    : `${result}${loader}`
}

/** 只改写 200 的 HTML 响应（会缓冲整个响应体；每日页约 40–60KB，loader 只按日期计算） */
export async function deferHydration(response: Response): Promise<Response> {
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html'))
    return response
  const html = deferHydrationHtml(await response.text())
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(html, { status: response.status, statusText: response.statusText, headers })
}
