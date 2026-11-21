import { describe, expect, it } from 'vitest'
import { dictionarySource, messageOrder, splitMessageModule } from './locale-split.ts'

// Paraglide 2 message-modules 输出的结构（节选）：每种语言一个函数，相同文案以别名去重，最后按语言分派
const MODULE = `/* eslint-disable */
import * as registry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

const en_greet = /** @type {(inputs: GreetInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (\`Hello \${i?.name}\`)
};

const ko_greet = /** @type {(inputs: GreetInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (\`안녕 \${i?.name}\`)
};

const ja_greet = /** @type {(inputs: GreetInputs) => LocalizedString} */ (i) => {
	const countPlural = registry.plural("ja", i?.count, {});return /** @type {LocalizedString} */ (\`こんにちは \${i?.name}\`)
};

const es_greet = en_greet;

export const greet = ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "ko") return ko_greet(inputs)
	if (locale === "ja") return ja_greet(inputs)
	if (locale === "es") return es_greet(inputs)
	return en_greet(inputs)
});
`

describe('新语言文案拆分（add-locales-eu-ja 1.6）', () => {
  it('删除拆分语言的函数与分派行，保留 v1 语言，在回退前查表', () => {
    const { code, removed } = splitMessageModule(MODULE, 42, ['ja', 'es'], '/x/split.ts')
    expect(code).not.toContain('こんにちは')
    expect(code).not.toContain('ja_greet')
    expect(code).not.toContain('es_greet')
    expect(code).toContain('if (locale === "ko") return ko_greet(inputs)')
    expect(code).toContain('안녕')
    expect(code).toContain('\n\treturn __splitMessage(locale, 42, en_greet)(inputs)')
    expect(code).toContain('import { splitMessage as __splitMessage } from "/x/split.ts"')
    // ja 的函数（含复数规则调用）原样进字典；es 与英文相同（别名），不进字典，由回退处理
    expect(removed.get('ja')).toMatch(/^\(i\) => \{\n\tconst countPlural = registry\.plural\("ja"/)
    expect(removed.get('ja')).toContain('こんにちは')
    expect(removed.get('es')).toBeNull()
  })

  it('拆分语言都是基础语言的别名时只删除分派，不加查表调用', () => {
    const { code, removed } = splitMessageModule(MODULE, 5, ['es'], '/x/split.ts')
    expect(removed.get('es')).toBeNull()
    expect(code).not.toContain('es_greet')
    expect(code).not.toContain('__splitMessage')
    expect(code).toContain('\n\treturn en_greet(inputs)')
    expect(code).toContain('こんにちは')
  })

  it('不含拆分语言的模块原样返回', () => {
    const { code, removed } = splitMessageModule(MODULE, 1, ['fr'])
    expect(code).toBe(MODULE)
    expect(removed.size).toBe(0)
  })

  it('改写后的模块按语言执行结果不变：ja 查字典，es 与 ko 照旧', async () => {
    const dictionary: Record<number, (i: unknown) => string> = {}
    const { code, removed } = splitMessageModule(MODULE, 7, ['ja', 'es'], 'split')
    const registry = { plural: () => 'other' }
    dictionary[7] = new Function('registry', `return ${removed.get('ja')}`)(registry)
    const body = code.replace(/^import .*$/gm, '').replace('export const greet =', 'return')
    const greet = new Function(
      '__splitMessage',
      'getLocale',
      'experimentalStaticLocale',
      'registry',
      body,
    )(
      (locale: string, index: number, fallback: (i: unknown) => string) =>
        (locale === 'ja' ? dictionary[index] : undefined) ?? fallback,
      () => 'en',
      undefined,
      registry,
    ) as (inputs: object, options: { locale: string }) => string
    expect(greet({ name: 'A' }, { locale: 'ja' })).toBe('こんにちは A')
    expect(greet({ name: 'A' }, { locale: 'es' })).toBe('Hello A')
    expect(greet({ name: 'A' }, { locale: 'ko' })).toBe('안녕 A')
    expect(greet({ name: 'A' }, { locale: 'en' })).toBe('Hello A')
  })

  it('字典分包按序号输出，并引用复数规则', () => {
    const source = dictionarySource(
      new Map([
        [9, '(i) => "b"'],
        [2, '(i) => "a"'],
      ]),
      '/p/registry.js',
    )
    expect(source).toBe(
      'import * as registry from "/p/registry.js"\nexport default {\n2: (i) => "a",\n9: (i) => "b",\n}\n',
    )
  })

  it('序号顺序：全站常用前缀在前，其余按键名；与输入顺序无关', () => {
    const keys = ['zeta_a', 'daily_b', 'admin_x', 'theme_a', 'daily_a', 'alpha']
    expect(messageOrder(keys)).toEqual([
      'theme_a',
      'daily_a',
      'daily_b',
      'admin_x',
      'alpha',
      'zeta_a',
    ])
    expect(messageOrder([...keys].reverse())).toEqual(messageOrder(keys))
  })
})
