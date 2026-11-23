// 年度太歲集合（content/tai-sui-year）的引擎复算（openspec content-growth-v2-tools 第 18 组、design 决策 16 第 6 项）：
// 正文、导语与 FAQ 中写到的干支年、立春与春节日期、「屬X（值／沖／刑／害／破太歲）」逐项用 @xuanxue/bazi/almanac 复算，
// 并确认写到的犯太歲生肖与引擎一致、没有遗漏。
// 运行：node scripts/check-content-tai-sui-year.mjs
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { zodiacYearFacts, zodiacYears } from '../packages/bazi/src/almanac.ts'

const ROOT = new URL('../apps/web/content/tai-sui-year/', import.meta.url)
const STEM = {
  jia: '甲',
  yi: '乙',
  bing: '丙',
  ding: '丁',
  wu: '戊',
  ji: '己',
  geng: '庚',
  xin: '辛',
  ren: '壬',
  gui: '癸',
}
const BRANCH_KEYS = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
]
const BRANCH = '子丑寅卯辰巳午未申酉戌亥'
const ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬'
const TAI_SUI = { 值: 'zhi', 沖: 'chong', 刑: 'xing', 害: 'hai', 破: 'po' }

let checked = 0
for (const locale of readdirSync(ROOT)) {
  for (const file of readdirSync(new URL(`${locale}/`, ROOT))) {
    const year = Number(file.replace(/\.mdx$/, ''))
    const text = readFileSync(new URL(`${locale}/${file}`, ROOT), 'utf8')
    const where = `${locale}/${file}`
    const facts = zodiacYearFacts(year)
    const ganzhi = `${STEM[facts.stem]}${BRANCH[BRANCH_KEYS.indexOf(facts.branch)]}`
    const row = zodiacYears(facts.branch).find((item) => item.year === year)
    assert.ok(row, `${where}: 引擎没有 ${year} 年的数据`)

    // 干支年：「2027年是丁未年」「2027丁未」
    for (const [, written] of text.matchAll(
      new RegExp(`${year}年?是?([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])`, 'g'),
    )) {
      assert.equal(written, ganzhi, `${where}: ${year} 年干支写成 ${written}`)
      checked++
    }
    // 立春与春节日期
    const lichun = /(\d+)月(\d+)日立春/.exec(text)
    assert.ok(lichun, `${where}: 没有写立春日期`)
    assert.deepEqual(
      [Number(lichun[1]), Number(lichun[2])],
      [row.lichun.month, row.lichun.day],
      `${where}: 立春日期`,
    )
    const newYear = /春節則?在(\d+)月(\d+)日/.exec(text) ?? /春節是(\d+)月(\d+)日/.exec(text)
    assert.ok(newYear, `${where}: 没有写春节日期`)
    assert.deepEqual(
      [Number(newYear[1]), Number(newYear[2])],
      [row.lunarNewYear.month, row.lunarNewYear.day],
      `${where}: 春节日期`,
    )
    checked += 2

    // 「屬羊（值太歲）」「屬牛（沖太歲兼刑太歲）」：括号内的关系与引擎一致；写到的生肖覆盖全部犯太歲生肖
    const expected = new Map(
      facts.rows
        .filter((item) => item.taiSui.length > 0)
        .map((item) => [ZODIAC[BRANCH_KEYS.indexOf(item.branch)], [...item.taiSui].sort()]),
    )
    const seen = new Set()
    for (const [, zodiac, relations] of text.matchAll(
      /屬([鼠牛虎兔龍蛇馬羊猴雞狗豬])（([^）]*太歲[^）]*)）/g,
    )) {
      const written = [...relations.matchAll(/([值沖刑害破])太歲/g)]
        .map(([, key]) => TAI_SUI[key])
        .sort()
      assert.deepEqual(
        written,
        expected.get(zodiac) ?? [],
        `${where}: 屬${zodiac}的太歲关系写成 ${relations}`,
      )
      seen.add(zodiac)
      checked++
    }
    for (const zodiac of expected.keys())
      assert.ok(seen.has(zodiac), `${where}: 没有写到屬${zodiac}`)
  }
}
console.log(`年度太歲内容复算通过：${checked} 项`)
