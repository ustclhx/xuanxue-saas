export interface I18nHead {
  lang: string | null
  canonical: string[]
  alternates: [string, string][]
  robots: string | null
  langQueryLinks: number
  prompt: boolean
}
export interface I18nPage extends I18nHead {
  status: number
  location: string | null
  setCookie: string
  xRobots: string | null
}
export interface I18nVariant {
  language: string | null
  status: number
  location: string | null
  body: string
}
export const ACCEPT_LANGUAGES: readonly (string | null)[]
export const LOCALE_COOKIES: readonly string[]
export function parseI18nHead(html: string): I18nHead
export function analyzeI18nSeo(input: {
  pages: Record<string, I18nPage>
  sitemap: readonly string[]
  variants?: Record<string, readonly I18nVariant[]>
}): string[]
export function crawlSite(
  baseUrl: string,
  host: string,
  homes: readonly string[],
): Promise<{
  sitemap: string[]
  pages: Record<string, I18nPage>
  variants: Record<string, I18nVariant[]>
}>
