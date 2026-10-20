import { HANT_PAIRS } from './hant-chars.ts'

let table: Map<string, string> | undefined

/**
 * 把繁中报告里混入的简体字换成台湾繁体（5.1 抽检：提示词约束后模型仍偶尔夹杂简体字）。
 * 只做无歧义的单字替换，已是繁体的文本不变，可重复调用；其他语言原样返回。
 */
export function toTraditional(text: string, locale: string): string {
  if (locale !== 'zh-Hant') return text
  if (!table) {
    table = new Map()
    for (let index = 0; index < HANT_PAIRS.length; index += 2)
      table.set(HANT_PAIRS.charAt(index), HANT_PAIRS.charAt(index + 1))
  }
  const map = table
  return text.replace(/[㐀-鿿]/g, (char) => map.get(char) ?? char)
}
