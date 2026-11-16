// 项目自有：模板只创建本文件，之后不再修改（template-sync 不会覆盖这里的改动）。
//
// 根布局对返回的每一项输出字体 preload。预加载会在首帧前占用带宽：只预加载首屏正文确实使用的字体文件。
// 本项目两站都在 brand.css 用 --font-sans 换掉了 Inter（东方站系统字体栈、西方站 Source Sans 3），
// 营销页不使用 Inter，预加载它只会在首帧前多下载约 71KB（redesign-home-chart-visuals 10.1 复测），因此关闭。
// 站点字体样式表由 features/site/theme.ts 在首帧后插入，按 unicode-range 拆分的 CJK 字体不预加载。
import type { FontPreload } from '@xuanxue/ui/fonts'

export function projectFontPreloads(): readonly FontPreload[] {
  return []
}
