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
  hydration: string[]
  hydrationGzipBytes: number
  zodSources: string[]
}
export function stripComments(code: string): string
export function htmlScripts(html: string): string[]
export function entryScripts(html: string): string[]
export function entryDynamicImports(clientDir: string, entries: readonly string[]): string[]
export function decodeMappings(mappings: string): [number, number][]
export function zodBindings(sourceCode: string): Set<string>
export function zodSources(
  clientDir: string,
  files: readonly string[],
  offending: readonly string[],
): string[]
export function staticClosure(clientDir: string, entries: readonly string[]): string[]
export function checkHomePage(clientDir: string, file?: string): HomePageResult
export function checkHomeBundle(clientDir: string): HomePageResult
export function checkServerHomeBundle(serverDir: string): {
  files: string[]
  gzipBytes: number
  violations: { asset: string; marker: string }[]
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
export const TOOL_PAGES: readonly { id: string; file: string }[]
export const LANDING_FORBIDDEN_SOURCES: readonly string[]
export const SPLIT_PAGES: readonly { file: string; forbiddenSources: readonly string[] }[]
export function checkToolPages(
  clientDir: string,
  pages?: readonly { id: string; file: string }[],
  snapshot?: Record<string, HomeHead>,
): { id: string; file: string; headDiffs: string[] }[]
export function closureSources(clientDir: string, file: string): string[]
export function checkSplitPages(
  clientDir: string,
  pages?: readonly { file: string; forbiddenSources: readonly string[] }[],
): { file: string; unmapped: boolean; found: string[] }[]
export function reportToolPages(
  tools: ReturnType<typeof checkToolPages>,
  splits: ReturnType<typeof checkSplitPages>,
): { ok: boolean; lines: string[] }
