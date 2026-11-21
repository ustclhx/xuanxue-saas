import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { installTextPack, localeText, type TextPack } from '../src/features/i18n/split-messages.ts'
import {
  dictionarySource,
  messageOrder,
  splitLocaleText,
  splitMessageModule,
  textCallId,
  textPlaceholder,
} from './locale-split.ts'

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

  it('拆分语言都与基础语言相同（别名）时只删除分派，不加查表', () => {
    const { code, removed } = splitMessageModule(MODULE, 3, ['es'], '/x/split.ts')
    expect(removed.get('es')).toBeNull()
    expect(code).not.toContain('es_greet')
    expect(code).not.toContain('__splitMessage')
    expect(code).toContain('\n\treturn en_greet(inputs)')
    expect(code).toContain('ja_greet')
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
    expect(dictionarySource(new Map(), '/r.js', 'ja')).toContain(
      `installTextPack("ja", "${textPlaceholder('ja')}")`,
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

// localeText 调用经 TypeScript 去除后的形态（插件在普通顺序处理）
const TEXT_MODULE = `import { localeText } from "./split-messages.ts";
const helper = (locale) => locale;
export const HOME = localeText({
  en: ["Free tools", "Desc"],
  ko: ["무료", "설명"],
  ja: ["無料の四柱推命", \`説明\`],
  es: ["Herramientas", "Desc es"],
});
export const PAGES = localeText({
  ko: { "/": helper("ko"), "/faq": ["FAQ ko", "d"] },
  ja: { "/": helper("ja"), "/faq": ["よくある質問", "説明"], "/n": [1, -2, true, null] },
});
export const SPREADS = localeText({
  daily: { en: "Daily", ja: "一枚引き" },
  list: [{ en: "a", ja: "あ" }, { en: "b" }],
  spread: [...[], { en: "c", ja: "し" }],
  slug: { en: "daily", ja: helper("x") },
});
export const untouched = { en: "x", ja: "y" };
`

describe('按语言文案表拆分（localeText）', () => {
  it('移出拆分语言的字面量条目，v1 语言与动态条目原样保留', () => {
    const { code, patches } = splitLocaleText(TEXT_MODULE, ['ja', 'es'], 'src/x.ts')
    expect(code).not.toContain('無料の四柱推命')
    expect(code).not.toContain('Herramientas')
    expect(code).not.toContain('よくある質問')
    expect(code).not.toContain('一枚引き')
    expect(code).not.toContain('"あ"')
    expect(code).toContain('무료')
    expect(code).toContain('helper("ja")')
    // 展开之后的数组下标不可寻址，保持原样；动态值保持原样；未包的对象不处理
    expect(code).toContain('ja: "し"')
    expect(code).toContain('ja: helper("x")')
    expect(code).toContain('export const untouched = { en: "x", ja: "y" }')
    expect(code).toContain(`/* @__PURE__ */ localeText(`)
    const [home, pages, spreads] = [0, 1, 2].map((n) => textCallId('src/x.ts', n))
    expect(code).toContain(`, "${home}")`)
    expect(patches.get(home ?? '')?.get('ja')).toEqual([[[], ['無料の四柱推命', '説明']]])
    expect(patches.get(home ?? '')?.get('es')).toEqual([[[], ['Herramientas', 'Desc es']]])
    expect(patches.get(pages ?? '')?.get('ja')).toEqual([
      [[], { '/faq': ['よくある質問', '説明'], '/n': [1, -2, true, null] }],
    ])
    expect(patches.get(spreads ?? '')?.get('ja')).toEqual([
      [['daily'], '一枚引き'],
      [['list', 0], 'あ'],
    ])
  })

  it('改写后的模块在加载补丁后与原模块逐项相同（模块先求值、补丁后到，以及补丁先到两种顺序）', () => {
    const { code, patches } = splitLocaleText(TEXT_MODULE, ['ja'], 'src/y.ts')
    const run = (source: string) => {
      const body = source
        .replace(/^import .*$/m, '')
        .replace(/export const (\w+) =/g, 'exports.$1 =')
      const exports: Record<string, unknown> = {}
      new Function('localeText', 'exports', body)(localeText, exports)
      return exports
    }
    const pack: TextPack = Object.fromEntries(
      [...patches].map(([id, byLocale]) => [id, byLocale.get('ja') ?? []]),
    )
    const original = run(TEXT_MODULE)
    const before = run(code)
    expect(before).not.toEqual(original)
    installTextPack('ja', pack)
    expect(before).toEqual(original)
    // 补丁已安装后才创建的对象（如函数内的表）在 localeText 中写回
    expect(run(code)).toEqual(original)
  })

  it('不含调用或没有拆分语言时原样返回', () => {
    expect(splitLocaleText('const a = { ja: "x" }', ['ja'], 'a').code).toBe('const a = { ja: "x" }')
    // 没有拆分语言：去掉全部包装（运行时不再引用 localeText）
    const plain = splitLocaleText(TEXT_MODULE, [], 'a')
    expect(plain.patches.size).toBe(0)
    expect(plain.code).not.toMatch(/localeText\(/)
    expect(plain.code).toContain('export const HOME = ({')
  })
})

// 模拟新增两种语言（add-locales-eu-ja 决策 11 验收）：文案量按 ja 分支实测量级（首页标题 / 描述、静态页 7 条、
// 牌阵 4 组标题与描述），用不重复的伪词避免 gzip 把重复文本压掉。拆分后首页闭包中的模块应与不加新语言时几乎一样大。
describe('模拟新增语言：首页闭包增量', () => {
  const gzip = (code: string) => gzipSync(code, { level: 9 }).length
  let seed = 7
  const word = () => {
    seed = (seed * 48271) % 2147483647
    const letters = 'aeioukstnhmrylwgdbpz'
    let out = ''
    for (let i = 0; i < 2 + (seed % 7); i++) out += letters[(seed >> (i * 3)) % letters.length]
    return out
  }
  const sentence = (words: number) => Array.from({ length: words }, word).join(' ')
  const V1 = ['en', 'zh-Hant', 'zh-Hans', 'ko']
  // 每种语言的条目在同一次生成中固定，便于比较「加 / 不加新语言」
  const entries = (locales: readonly string[]) => {
    const table = new Map<string, { home: string[]; pages: string[][]; spreads: string[][] }>()
    for (const locale of locales)
      table.set(locale, {
        home: [sentence(8), sentence(30), sentence(5)],
        pages: Array.from({ length: 7 }, () => [sentence(6), sentence(24)]),
        spreads: Array.from({ length: 4 }, () => [sentence(4), sentence(26)]),
      })
    return table
  }
  const all = entries([...V1, 'xa', 'xb'])
  const moduleFor = (locales: readonly string[]) => {
    const pick = (fn: (e: NonNullable<ReturnType<typeof all.get>>) => string) =>
      locales.map((l) => `  ${JSON.stringify(l)}: ${fn(all.get(l) as never)},`).join('\n')
    return [
      'import { localeText } from "./split-messages.ts";',
      `export const HOME = localeText({\n${pick((e) => JSON.stringify(e.home))}\n});`,
      `export const PAGES = localeText({\n${pick((e) => `{ ${e.pages.map((p, i) => `"/p${i}": ${JSON.stringify(p)}`).join(', ')} }`)}\n});`,
      `export const SPREADS = localeText({\n${[0, 1, 2, 3]
        .map(
          (i) =>
            `  s${i}: { ${locales.map((l) => `${JSON.stringify(l)}: ${JSON.stringify(all.get(l)?.spreads[i]?.[0])}`).join(', ')} },`,
        )
        .join('\n')}\n});`,
      'export const use = (l) => [HOME[l], PAGES[l], SPREADS.s0[l]];',
    ].join('\n')
  }

  it('文案表：加两种新语言，首页模块 gzip 增量接近 0，新语言文本全部进入字典', () => {
    const base = splitLocaleText(moduleFor(V1), ['xa', 'xb'], 'src/sim.ts')
    const withNew = splitLocaleText(moduleFor([...V1, 'xa', 'xb']), ['xa', 'xb'], 'src/sim.ts')
    const raw = gzip(moduleFor([...V1, 'xa', 'xb'])) - gzip(moduleFor(V1))
    const delta = gzip(withNew.code) - gzip(base.code)
    // 不拆分时两种语言约增加 1.5KB gzip；拆分后只剩三个调用点标识
    expect(raw).toBeGreaterThan(1000)
    expect(delta).toBeLessThanOrEqual(60)
    const pack = JSON.stringify([...withNew.patches.values()].map((m) => m.get('xa')))
    expect(pack).toContain(all.get('xa')?.home[1])
    expect(withNew.code).not.toContain(all.get('xb')?.pages[3]?.[1])
  })

  it('Paraglide 文案：第一种新语言只加一次查表，第二种新语言不再增加', () => {
    const message = (locales: readonly string[]) =>
      `import { getLocale, experimentalStaticLocale } from '../runtime.js';\n\n${locales
        .map(
          (l) => `const ${l}_k = /** @type {any} */ () => {\n\treturn \`${sentence(12)}\`\n};\n\n`,
        )
        .join(
          '',
        )}export const k = ((inputs, options = {}) => {\n\tconst locale = experimentalStaticLocale ?? options.locale ?? getLocale()\n${locales
        .filter((l) => l !== 'en')
        .map((l) => `\tif (locale === "${l}") return ${l}_k(inputs)\n`)
        .join('')}\treturn en_k(inputs)\n});\n`
    seed = 11
    const one = splitMessageModule(message(['en', 'ko', 'xa']), 5, ['xa', 'xb'], 'r').code
    seed = 11
    const two = splitMessageModule(message(['en', 'ko', 'xa', 'xb']), 5, ['xa', 'xb'], 'r').code
    // 只差删除定义后留下的空行（压缩时去掉）
    const squash = (code: string) => code.replace(/\n+/g, '\n')
    expect(squash(two)).toBe(squash(one))
    expect(one).toContain('__splitMessage(locale, 5, en_k)')
  })
})
