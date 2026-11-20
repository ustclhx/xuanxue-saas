// node --test apps/web/scripts/check-locale-glossary.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import {
  checkAnchors,
  checkLocale,
  compileGlossary,
  expandGlobs,
  globToRegExp,
  loadGlossaries,
  scanText,
  textOf,
  validateGlossary,
} from './check-locale-glossary.mjs'

const glossaries = Object.fromEntries(loadGlossaries().map((g) => [g.locale, g.glossary]))
const hits = (locale, text, file = 'apps/web/content/tarot/x/a.mdx') =>
  scanText(text, compileGlossary(glossaries[locale]), { file }).map((h) => h.banned)

describe('仓库中的术语表', () => {
  test('ja 与 es 结构有效（合规三项、锚文本 ≤2、首选写法不冲突）', () => {
    for (const locale of ['ja', 'es']) {
      assert.ok(glossaries[locale], `缺少 ${locale}.json`)
      assert.deepEqual(validateGlossary(glossaries[locale], locale), [], locale)
    }
  })

  test('ja：正位置 / 逆位置不误报，单独的「正位」「逆位」报错', () => {
    assert.deepEqual(hits('ja', '太陽の正位置は喜び、逆位置は慢心。'), [])
    assert.deepEqual(hits('ja', '太陽の逆位は慢心。'), ['逆位'])
  })

  test('ja：命盤只在四柱推命语境报错，紫微斗数文件与「紫微斗数の命盤」放行', () => {
    assert.equal(hits('ja', '四柱推命の命盤を読む').length, 1)
    assert.deepEqual(hits('ja', '紫微斗数の命盤を読む'), [])
    assert.deepEqual(hits('ja', '命盤の十二宮', 'apps/web/messages/ja/chart-ziwei.json'), [])
  })

  test('ja：保证性说法的否定句放行，肯定句报错；简体字形报错', () => {
    assert.deepEqual(
      hits('ja', '必ず当たるとは限りません。的中率を保証するものではありません。'),
      [],
    )
    assert.equal(hits('ja', '必ず当たる占い').length, 1)
    assert.equal(hits('ja', '娯楽としてお楽しみください').length, 1)
    assert.equal(hits('ja', '今日の运势').length, 2, '运、势各一处')
    assert.deepEqual(hits('ja', '皇后陛下の誕生日'), [])
    assert.equal(hits('ja', 'カップの皇后').length, 1)
  })

  test('es：Oros 为花色名，图像描述中的 pentáculo 放行', () => {
    assert.equal(hits('es', 'El As de Pentáculos habla de oportunidades.').length, 1)
    assert.deepEqual(hits('es', 'La carta muestra un pentáculo dorado. As de Oros.'), [])
  })

  test('es：娱乐定位与保证说法报错，否定句放行', () => {
    assert.ok(hits('es', 'Solo con fines de entretenimiento.').length >= 1)
    assert.deepEqual(hits('es', 'Ningún método es infalible.'), [])
    assert.equal(hits('es', 'Nuestro método es infalible.').length, 1)
    assert.equal(hits('es', 'Te garantizamos una respuesta.').length, 1)
  })

  test('es：中性拉美西语——vosotros 变位、coger、voseo 报错，常见词不误报', () => {
    assert.equal(hits('es', 'Si habéis elegido una carta').length, 2)
    assert.equal(hits('es', 'Coge una carta del mazo').length, 1)
    assert.equal(hits('es', 'Si tenés dudas').length, 1)
    assert.deepEqual(
      hits('es', 'En mi país, desde el dispositivo móvil, el cambio fue revertido.'),
      [],
    )
    assert.equal(hits('es', 'Guárdalo en tu móvil').length, 1)
  })
})

describe('结构校验', () => {
  const base = {
    locale: 'es',
    status: 'draft',
    terms: [{ id: 'a', preferred: 'Oros', banned: ['Pentáculos'] }],
    compliance: {
      required: [
        { id: 'traditional-method', phrases: ['métodos tradicionales'] },
        { id: 'reference-only', phrases: ['solo como referencia'] },
        { id: 'no-prediction', phrases: ['no predice el futuro'] },
      ],
      banned: ['entretenimiento'],
    },
    anchors: { '/es/tarot': ['tarot gratis'] },
  }

  test('合规表述缺项、锚文本超过 2 种、首选写法命中禁用写法都报错', () => {
    assert.deepEqual(validateGlossary(base, 'es'), [])
    const broken = {
      ...base,
      terms: [...base.terms, { id: 'b', preferred: 'Pentáculos' }],
      compliance: { ...base.compliance, required: base.compliance.required.slice(1) },
      anchors: { '/es/tarot': ['a', 'b', 'c'] },
    }
    const errors = validateGlossary(broken, 'es')
    assert.ok(errors.some((e) => e.includes('traditional-method')))
    assert.ok(errors.some((e) => e.includes('锚文本 /es/tarot')))
    assert.ok(errors.some((e) => e.includes('术语 b')))
  })

  test('allowFor 让指定术语的写法可与禁用写法相同', () => {
    const g = {
      ...base,
      terms: [
        { id: 'a', preferred: 'Oros', banned: [{ text: 'Discos', allowFor: ['b'] }] },
        { id: 'b', preferred: 'Discos' },
      ],
    }
    assert.deepEqual(validateGlossary(g, 'es'), [])
  })
})

describe('文件扫描', () => {
  test('glob：* 不跨目录，** 跨任意层', () => {
    assert.ok(
      globToRegExp('apps/web/content/*/es/**/*.mdx').test('apps/web/content/tarot/es/a.mdx'),
    )
    assert.ok(
      globToRegExp('apps/web/content/*/es/**/*.mdx').test(
        'apps/web/content/legal/west/es/a.mdx',
      ) === false,
    )
    assert.ok(
      globToRegExp('apps/web/content/legal/*/es/**/*.mdx').test(
        'apps/web/content/legal/west/es/x/a.mdx',
      ),
    )
  })

  test('JSON 只查值不查键（行号不变）；MDX 去掉链接地址', () => {
    const json = '{\n  "spread_title": "Spread",\n  "x": "ok"\n}'
    const text = textOf('a.json', json)
    assert.equal(text.split('\n').length, 4)
    assert.ok(!text.includes('spread_title'))
    assert.ok(text.includes('"Spread"'))
    assert.ok(!textOf('a.mdx', '[El Sol](/es/tarot/cartas/the-sun)').includes('the-sun'))
  })

  test('MDX 链接锚文本须在白名单内（{card}/{n} 为占位）', () => {
    const g = glossaries.es
    const raw =
      '[número de vida](/es/numero-de-vida) y [haz clic aquí](/es/numero-de-vida) y [número de vida 7](/es/numero-de-vida/7) y [El Sol](/es/tarot/cartas/the-sun)'
    const out = checkAnchors('a.mdx', raw, g)
    assert.equal(out.length, 1)
    assert.match(out[0].banned, /haz clic aquí/)
  })

  test('checkLocale：报告禁用写法位置，缺少合规表述，requiredIn 文件须包含', () => {
    const root = mkdtempSync(join(tmpdir(), 'glossary-'))
    const write = (rel, body) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), body)
    }
    try {
      write('apps/web/messages/es/tarot.json', '{\n  "a": "As de Pentáculos"\n}\n')
      write(
        'apps/web/content/legal/west/es/disclaimer.mdx',
        '---\ntitle: x\n---\nSolo como referencia.\n',
      )
      const g = {
        ...glossaries.es,
        compliance: {
          ...glossaries.es.compliance,
          required: glossaries.es.compliance.required.map((r) =>
            r.id === 'traditional-method'
              ? { ...r, requiredIn: ['apps/web/content/legal/*/es/disclaimer.mdx'] }
              : r,
          ),
        },
      }
      const result = checkLocale(g, { root })
      assert.deepEqual(result.errors, [])
      assert.equal(result.files.length, 2)
      const banned = result.findings.find((f) => f.source.startsWith('terms:'))
      assert.deepEqual([banned.file, banned.line], ['apps/web/messages/es/tarot.json', 2])
      const missing = result.findings
        .filter((f) => f.banned.startsWith('缺少合规表述'))
        .map((f) => f.banned)
      assert.ok(missing.includes('缺少合规表述 traditional-method'))
      assert.ok(missing.includes('缺少合规表述 no-prediction'))
      assert.ok(!missing.includes('缺少合规表述 reference-only'), '大小写不敏感')
      assert.ok(result.findings.some((f) => f.file.endsWith('disclaimer.mdx')))
      assert.deepEqual(expandGlobs(['apps/web/messages/es/*.json'], root), [
        'apps/web/messages/es/tarot.json',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
