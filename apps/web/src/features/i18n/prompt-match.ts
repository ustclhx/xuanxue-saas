import { languageLocale } from './preference.ts'
import { regionOf, scriptKey } from './suggestion.ts'

/**
 * 语言建议提示的匹配（使用者 2026-11-20 网址规则；设计稿 LocalePromptSpec「B · 行为规则」）：
 * 按浏览器偏好顺序取第一个能匹配到配置语言的标签：完整标签 → 语言+书写系统（zh-TW → zh-Hant，zh-CN → zh-Hans）
 * → 主语言（es-MX → es；带地区的 pt-BR 只接受 pt 与 pt-BR）。最先匹配到的语言就是访客最想要的，
 * 不再看后面的偏好。纯函数，便于测试。
 */
export function matchBrowserLocale<L extends string>(
  languages: readonly string[],
  locales: readonly L[],
): L | undefined {
  for (const raw of languages) {
    const tag = raw.trim().toLowerCase()
    if (!tag) continue
    const exact = locales.find((locale) => locale.toLowerCase() === tag)
    if (exact) return exact
    const key = scriptKey(tag)
    const byScript = key
      ? locales.find((locale) => regionOf(locale) === undefined && scriptKey(locale) === key)
      : undefined
    if (byScript) return byScript
    const byLanguage = languageLocale(tag, locales)
    if (byLanguage) return byLanguage
  }
  return undefined
}

/** 关闭记录（localStorage，按站点各自保存，永久；不用 Cookie） */
export function promptDismissedKey(site: string): string {
  return `locale-prompt-dismissed:${site}`
}

/**
 * 要提示的语言（0、1 或 2 个）：
 * - 浏览器最想要的语言就是当前页语言，或不在可提示范围（本站已发布、且当前页有该语言版本）时不提示；
 * - 第一个偏好是不带地区与书写系统的 `zh`、简繁两种都可提示时，并列给出两个候选（简体在前），
 *   当前页本身是中文时不提示；
 * - 访客关闭过（或在语言控件里手动选过语言）时不提示。
 */
export function promptLocales<L extends string>({
  languages,
  locales,
  offerable,
  current,
  dismissed,
}: {
  languages: readonly string[]
  /** 全部配置语言（判断访客最想要的语言） */
  locales: readonly L[]
  /** 本站已发布、当前页面有对应版本的语言 */
  offerable: readonly string[]
  current: string
  dismissed: boolean
}): L[] {
  if (dismissed) return []
  const first = languages.map((tag) => tag.trim().toLowerCase()).find(Boolean)
  if (first === 'zh') {
    // 只写 zh 的访客看得懂简繁任一种：当前页已是中文就不提示
    if (current.startsWith('zh')) return []
    const pair = (['zh-Hans', 'zh-Hant'] as const).filter((locale) => offerable.includes(locale))
    if (pair.length === 2) return pair as unknown as L[]
  }
  const wanted = matchBrowserLocale(languages, locales)
  if (!wanted || wanted === current || !offerable.includes(wanted)) return []
  return [wanted]
}

/** 语言控件里手动选择语言时同样写入关闭记录（设计稿 B「记住关闭」）；站点取自 <html data-site> */
export function rememberPromptChoice(): void {
  try {
    const site = document.documentElement.dataset.site
    if (site) window.localStorage.setItem(promptDismissedKey(site), '1')
  } catch {
    // 存储不可用
  }
}
