export const SHARE_CARD_MARKER: string
export const FORBIDDEN_MARKERS: readonly string[]
export const RENDERER_MARKERS: readonly string[]
export interface HomePage {
  id: string
  file: string
  budget: number
}
export const HOME_PAGES: readonly HomePage[]
export interface HomeHead {
  canonical: string | null
  hreflang: Record<string, string>
  robots: string | null
  jsonLd: string[]
}
export interface HomePageResult {
  files: string[]
  gzipBytes: number
  violations: { asset: string; marker: string }[]
}
export function stripComments(code: string): string
export function htmlScripts(html: string): string[]
export function staticClosure(clientDir: string, entries: readonly string[]): string[]
export function checkHomePage(clientDir: string, file?: string): HomePageResult
export function checkHomeBundle(clientDir: string): HomePageResult
export function checkServerHomeBundle(serverDir: string): HomePageResult & {
  routeEntries: string[]
}
export function reportServerHomeBundle(serverDir: string): { ok: boolean; lines: string[] }
export function homeHead(html: string): HomeHead
export function diffHomeHead(actual: HomeHead, expected: HomeHead | undefined): string[]
export function readHomeHeadSnapshot(): Record<string, HomeHead>
export function checkHomePages(
  clientDir: string,
  pages?: readonly HomePage[],
  snapshot?: Record<string, HomeHead>,
  configBudget?: number | null,
): (HomePage &
  HomePageResult & {
    zodWarnings: { asset: string; marker: string }[]
    overBudget: boolean
    head: HomeHead
    headDiffs: string[]
  })[]
export function reportHomePages(results: ReturnType<typeof checkHomePages>): {
  ok: boolean
  lines: string[]
  warnings: string[]
}
export const ZOD_MARKERS: readonly string[]
export function budgetViolation(gzipBytes: number, budget: number | null | undefined): string | null
export function readPerformanceOptions(
  distDir: string,
): { homeScriptGzipBudget?: number | null } | null
