import type { ParsedPage } from './check-links-graph.mjs'

export interface AuditFinding {
  rule: string
  page: string
  message: string
}
export interface AuditPage {
  path: string
  url: string
  status: number
  html?: string | undefined
  parsed?: ParsedPage | undefined
}
export interface AnchorWording {
  wording: string
  count: number
  sources: string[]
}
export interface AuditLinksResult {
  violations: AuditFinding[]
  notes: AuditFinding[]
  money: { path: string; inlinks: number; sources: string[] }[]
  anchors: { path: string; total: number; wordings: AnchorWording[]; topShare: number }[]
  bodyLinks: Record<string, number>
  hubs: string[]
}
export interface TdkRow {
  path: string
  lang: string
  title: string
  titleLength: number
  titleOver: boolean
  description: string
  descriptionLength: number
  descriptionOver: boolean
  h1: string[]
}

export const BODY_LINKS_MIN: number
export const BODY_LINKS_MAX: number
export const MONEY_INLINKS_MIN: number
export const ANCHOR_VARIANTS_MAX: number
export const ANCHOR_TOP_SHARE_MAX: number
export const ANCHOR_SHARE_MIN_LINKS: number
export const BODY_LINKS_EXEMPT: ReadonlyMap<string, string>
export const TDK_LIMITS: {
  latin: { title: [number, number]; description: [number, number] }
  cjk: { title: [number, number]; description: [number, number] }
}
export function normalizeAnchor(text: string): string
export function isCjkLocale(lang: string | null | undefined): boolean
export function cjkWidth(text: string): number
export function tdkLength(text: string, lang: string | null | undefined): number
export function headCopy(html: string): { title: string; description: string }
export function auditLinks(input: {
  pages: AuditPage[]
  targets: Map<string, number>
  indexable: Set<string>
  homes: string[]
  internalHosts: Set<string>
  moneyPages?: readonly string[]
  localePrefixes?: readonly string[]
}): AuditLinksResult
export function auditTdk(pages: AuditPage[]): TdkRow[]
export function formatAudit(
  sites: { host: string; links: AuditLinksResult; tdk: TdkRow[] }[],
): string
