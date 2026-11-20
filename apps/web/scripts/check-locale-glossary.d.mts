// check-locale-glossary.mjs 中供其他模块复用的部分（evals/readings-ja 的术语检查用）

export interface GlossaryBannedHit {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly banned: string
  readonly source: string
  readonly use: string | null
  readonly reason: string | null
  readonly excerpt: string
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
  options: { readonly file: string; readonly term?: string | null },
): GlossaryBannedHit[]
