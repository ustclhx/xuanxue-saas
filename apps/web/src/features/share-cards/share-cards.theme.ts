import type { SiteId } from '@xuanxue/config'
import type { ShareCardTheme } from './types.ts'

// 项目自有：品牌覆盖与 styles/brand.css 保持对应，模板之后不再修改。
// 填写颜色字面量时，在 scripts/check-ui.allow.local.json 按文件登记 exceptions，
// 原因：分享卡片在服务端渲染，无法读取 CSS 变量。

/**
 * 两站分享卡片配色，取值对应 brand.css 中 `:root[data-site]` 的站点 token：
 * background ← --bg，foreground ← --ink，muted / secondary ← --surface-2，mutedForeground ← --ink-subtle，
 * primary / brandAccent ← --accent，primaryText ← --accent-ink，primaryForeground ← --on-accent，border ← --line。
 * 东方站取浅色（2026-11-14 主底改为纯白），西方站本身为深色。
 *
 * 模板 0.4.0 的主题 API（theme.ts 的 resolveShareCardTheme）只支持单一项目覆盖；
 * 构建期分享图（scripts/og-images.ts）按页面所属站点叠加本表，待模板提供多站点扩展点后迁移。
 */
export const siteShareCardThemes: Readonly<Record<SiteId, Partial<ShareCardTheme>>> = {
  east: {
    background: '#ffffff',
    foreground: '#1f1c18',
    muted: '#f5f2ec',
    mutedForeground: '#6b6355',
    secondary: '#f5f2ec',
    primary: '#b8432f',
    primaryText: '#9e3a27',
    primaryForeground: '#fffdf8',
    brandAccent: '#b8432f',
    border: '#dcd3c1',
  },
  west: {
    background: '#11162a',
    foreground: '#ece7da',
    muted: '#151b33',
    mutedForeground: '#b9b5aa',
    secondary: '#151b33',
    primary: '#e3c36f',
    primaryText: '#e3c36f',
    primaryForeground: '#11162a',
    brandAccent: '#e3c36f',
    border: '#2a3150',
  },
}

/**
 * 运行时分享卡片与 /dev/ui 预览使用的单一覆盖。项目尚未注册卡片类型，暂保持模板基线：
 * 模板的版式单测按基线颜色断言，且单一覆盖无法同时表达两站配色。
 * 注册按站点区分的卡片类型时，在类型的 render 中按站点叠加 siteShareCardThemes。
 */
export const projectShareCardTheme: Partial<ShareCardTheme> = {}
