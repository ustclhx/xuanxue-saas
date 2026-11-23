import { isGwaeNumber } from './paths.ts'

export interface GwaeEntry {
  readonly title: string
  readonly summary: string
  readonly themes: { readonly work: string; readonly people: string; readonly self: string }
}

type GwaeFile = Readonly<Record<string, GwaeEntry>>

/**
 * 144 段解读按상괘分成 8 个 JSON（content/tojeong/ko/gwae/<상괘>.json，各 18 段），按需加载（决策 8）：
 * Vite 为每个文件生成独立分块，算出괘 번호后只下载对应상괘的一块，不进首屏包与预渲染 HTML。
 */
const files = import.meta.glob<GwaeFile>('../../../../content/tojeong/ko/gwae/*.json', {
  import: 'default',
})

export function gwaeFileKey(gwae: number): string {
  return `../../../../content/tojeong/ko/gwae/${Math.floor(gwae / 100)}.json`
}

export async function loadGwae(gwae: number): Promise<GwaeEntry | null> {
  if (!isGwaeNumber(gwae)) return null
  const load = files[gwaeFileKey(gwae)]
  if (!load) return null
  return (await load())[String(gwae)] ?? null
}
