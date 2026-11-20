// 从 gate.ts 拆出（首页路由只需要这一个函数；gate.ts 依赖注册表与东方站英文地址表，不进首页水合闭包）
/**
 * 落地页 head 中的内联脚本（design.md D4）：旧分享链接是 `<语言首页>#r=…`，片段不发往服务器。
 * 首帧前检查 `location.hash`，含 `r=` 参数时替换到主工具页并带上原片段；其他片段（页内锚点）不处理。
 * `toolHref` 为站内地址（已含语言前缀并编码，如 toolHref 的返回值），在构建期写入脚本，不依赖水合。
 */
export function legacyHashRedirectScript(toolHref: string): string {
  return `(function(){var h=location.hash;if(/[#&]r=/.test(h))location.replace(${JSON.stringify(toolHref)}+h)})()`
}
