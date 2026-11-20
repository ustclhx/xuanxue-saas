export const LEGAL_SOURCE_LOCALES: { readonly west: string; readonly east: string }
export const JA_LATIN_RATIO_MAX: number
export const JA_KANA_RATIO_MIN: number
export function japaneseTextIssue(source: string): string | null
export function checkLocaleContent(input: {
  root?: string
  locales: readonly string[]
  sites: { readonly [site: string]: { readonly locales: readonly string[] } }
}): string[]
