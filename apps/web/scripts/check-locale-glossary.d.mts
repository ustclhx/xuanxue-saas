// check-locale-glossary.mjs 中供 TypeScript 调用方（evals/readings 的术语表检查）使用的部分
export interface GlossaryFinding {
  readonly file: string
  readonly line: number
  readonly column?: number
  readonly banned: string
  readonly source: string
  readonly use: string | null
  readonly reason?: string | null
  readonly excerpt?: string
}
export interface CompiledGlossary {
  readonly banned: readonly unknown[]
  readonly masks: readonly RegExp[]
  readonly glossary: unknown
}
export function compileGlossary(glossary: unknown): CompiledGlossary
export function scanText(
  text: string,
  compiled: CompiledGlossary,
  options: { file: string; term?: string | null },
): GlossaryFinding[]
export function loadGlossaries(
  dir?: string,
): { readonly file: string; readonly locale: string; readonly glossary: unknown }[]
