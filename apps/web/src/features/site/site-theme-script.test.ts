// @vitest-environment happy-dom
import { THEME_STORAGE_KEY, themeInitScript } from '@xuanxue/ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_THEME_DEFAULT_MARK, siteThemeScript } from './theme.ts'

// 站点默认主题脚本（refresh-visual-system-warm D3）：与模板 themeInitScript 按 __root.tsx 中的顺序先后执行
function boot(site: 'east' | 'west', systemDark: boolean) {
  document.documentElement.setAttribute('data-site', site)
  document.documentElement.classList.remove('dark')
  window.matchMedia = ((query: string) => ({ matches: systemDark, media: query })) as never
  // biome-ignore lint/security/noGlobalEval: 测试中执行将写入 <head> 的内联脚本
  ;(0, eval)(siteThemeScript())
  // biome-ignore lint/security/noGlobalEval: 同上
  ;(0, eval)(themeInitScript())
  return document.documentElement.classList.contains('dark')
}

describe('siteThemeScript', () => {
  // Node 自带的 localStorage 在未提供存储文件时不可用，会遮住 happy-dom 的实现：用内存实现替换
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    })
  })

  it('西方站首次到访：系统为深色也渲染浅色，并保存为浅色', () => {
    expect(boot('west', true)).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(localStorage.getItem(SITE_THEME_DEFAULT_MARK)).toBe('1')
  })

  it('西方站：已选择深色时不改动', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(boot('west', false)).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('西方站：写入过默认值后改选跟随系统（主题键被删除），不再写回浅色', () => {
    boot('west', true)
    localStorage.removeItem(THEME_STORAGE_KEY)
    expect(boot('west', true)).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('东方站不写入默认值，未保存选择时跟随系统', () => {
    expect(boot('east', true)).toBe(true)
    expect(boot('east', false)).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(SITE_THEME_DEFAULT_MARK)).toBeNull()
  })
})
