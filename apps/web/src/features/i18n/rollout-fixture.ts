import type { SiteId } from '@xuanxue/config'
import { LOCALE_RELEASE, type ReleaseState } from './rollout.ts'

/**
 * 仅供测试：临时改写发布状态。ja、es 与东方站根路径英文 2026-11-21 发布后，「未发布语言不可被发现」等机制
 * 仍要用某种 pending 语言验证，测试用这里的覆盖代替真实发布表中的现状。
 * 直接修改 LOCALE_RELEASE（各模块读取的是同一个对象），返回恢复函数，须在 afterEach / finally 中调用。
 */
export type ReleaseOverrides = { readonly [S in SiteId]?: Readonly<Record<string, ReleaseState>> }

/** 2026-11-21 发布前的状态：ja、东方站 en 与西方站 es 均为 pending */
export const BEFORE_JA_ES_EAST_EN: ReleaseOverrides = {
  east: { ja: 'pending', en: 'pending' },
  west: { es: 'pending' },
}

export function overrideRelease(overrides: ReleaseOverrides): () => void {
  const saved: [Record<string, ReleaseState | undefined>, string, ReleaseState | undefined][] = []
  for (const [site, entries] of Object.entries(overrides) as [
    SiteId,
    Record<string, ReleaseState>,
  ][]) {
    const table = LOCALE_RELEASE[site] as Record<string, ReleaseState | undefined>
    for (const [locale, state] of Object.entries(entries)) {
      saved.push([table, locale, table[locale]])
      table[locale] = state
    }
  }
  return () => {
    for (const [table, locale, state] of saved.reverse()) {
      if (state === undefined) delete table[locale]
      else table[locale] = state
    }
  }
}

/** 在覆盖的发布状态下执行 `fn`，结束后恢复（同步函数） */
export function withRelease<T>(overrides: ReleaseOverrides, fn: () => T): T {
  const restore = overrideRelease(overrides)
  try {
    return fn()
  } finally {
    restore()
  }
}
