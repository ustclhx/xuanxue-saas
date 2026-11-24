// 核对第 23 组的出生星盘正文事实和同语言段落相似度。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dice } from '../apps/web/scripts/locale-similarity.mjs'
import {
  ASPECTS,
  chartHouses,
  chartPositions,
  findAspects,
  moonSignsBetween,
  PLACIDUS_MAX_LATITUDE,
  PLANET_KEYS,
  POINT_KEYS,
  SIGN_KEYS,
  zodiacPosition,
} from '../packages/astro/src/chart.ts'
import { localToUtc } from '../packages/astro/src/places.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const pages = ['birth-chart', 'rising-sign-calculator'].map((slug) => {
  const text = readFileSync(
    new URL(`../apps/web/content/natal-chart/en/${slug}.mdx`, import.meta.url),
    'utf8',
  )
  const [, metadata, body] = text.split(/^---$/m)
  const { title, description } = parseDocument(metadata).toJSON()
  assert.ok(`${title} | Arcanumber`.length >= 40 && `${title} | Arcanumber`.length <= 60, slug)
  assert.ok(description.length >= 140 && description.length <= 160, slug)
  const sections = body
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const newline = section.indexOf('\n')
      return {
        heading: section.slice(0, newline).trim(),
        prose: section
          .slice(newline + 1)
          .replace(/\[([^\]]+)\]\(\/[^)]+\)/g, '$1')
          .trim(),
      }
    })
  const words = sections.reduce((sum, { prose }) => sum + prose.split(/\s+/).length, 0)
  const links = [...body.matchAll(/\]\(\/[^)]+\)/g)]
  assert.ok(words >= 600, `${slug}: ${words} words`)
  assert.ok(links.length >= 2 && links.length <= 5, `${slug}: ${links.length} links`)
  return { body, sections, words }
})
const [birth, rising] = pages
const pairs = birth.sections.flatMap((a) =>
  rising.sections.map((b) => dice(a.prose, b.prose, 'word')),
)
const peak = Math.max(...pairs)
assert.ok(peak <= 0.3, `highest section similarity: ${peak}`)

// 正文使用的引擎口径：角度、容许度、高纬阈值、宫制与时区换算。
assert.equal(PLANET_KEYS.length, 10)
assert.equal(POINT_KEYS.length, 11)
assert.equal(SIGN_KEYS.length, 12)
assert.equal(360 / SIGN_KEYS.length, 30)
assert.equal((PLANET_KEYS.length * (PLANET_KEYS.length - 1)) / 2, 45)
assert.equal(SIGN_KEYS.length - PLANET_KEYS.length, 2)
for (const { key, angle, orb } of ASPECTS) {
  assert.ok(birth.body.includes(`${key} at ${angle}°`), key)
  assert.equal(orb, key === 'sextile' ? 6 : 8)
}
assert.match(
  birth.body,
  /8° for the conjunction, square, trine and opposition, and 6° for the sextile/,
)
assert.ok(birth.body.includes(`Beyond ${PLACIDUS_MAX_LATITUDE}° north or south`))
const date = Date.UTC(1990, 4, 15, 9, 30)
const west = chartHouses(date, 38.72, -9.14)
const east = chartHouses(date, 38.72, -8.91)
assert.ok(Math.abs(west.ascendant - east.ascendant) < 0.2)
assert.ok(rising.body.includes('less than a fifth of a degree'))
assert.equal(
  localToUtc({ year: 1990, month: 5, day: 15, hour: 10, minute: 30 }, 'Europe/Lisbon').utcMs,
  date,
)
const whole = chartHouses(date, 38.72, -9.14, 'whole-sign')
assert.ok(whole.houses.cusps.every((cusp) => cusp % 30 === 0))
assert.ok(chartHouses(date, 67, 0).houses.highLatitudeFallback)
assert.ok(chartHouses(date, -67, 0).houses.highLatitudeFallback)

const day = 86_400_000
const spans = (start, end, step, signAt) => {
  const result = []
  let previous = signAt(start)
  let lastChange
  for (let t = start + step; t < end; t += step) {
    const sign = signAt(t)
    if (sign === previous) continue
    if (lastChange !== undefined) result.push({ sign: previous, units: (t - lastChange) / step })
    lastChange = t
    previous = sign
  }
  return result
}
const moonHours = spans(
  Date.UTC(2000, 0, 1),
  Date.UTC(2020, 0, 1),
  3_600_000,
  (t) => moonSignsBetween(t, t)[0],
).map(({ units }) => units)
const mean = moonHours.reduce((sum, hours) => sum + hours, 0) / moonHours.length
assert.ok(Math.abs(mean / 24 - 2.25) < 0.05)
assert.deepEqual([Math.min(...moonHours), Math.max(...moonHours)], [47, 61])
assert.match(
  rising.body,
  /about two and a quarter days on average, with observed stays of about 47 to 61 hours/,
)
const ascSpans = (lat) => {
  const start = Date.UTC(2026, 2, 20)
  return new Map(
    spans(
      start,
      start + 2 * day,
      60_000,
      (t) => zodiacPosition(chartHouses(t, lat, 0, 'whole-sign').ascendant).sign,
    ).map(({ sign, units }) => [sign, units]),
  )
}
const fortieth = ascSpans(40)
assert.ok(['pisces', 'aries'].every((sign) => Math.abs(fortieth.get(sign) - 75) < 5))
assert.ok(
  ['leo', 'virgo', 'libra', 'scorpio'].every((sign) => Math.abs(fortieth.get(sign) - 150) < 5),
)
const london = ascSpans(51.5)
assert.ok(['pisces', 'aries'].every((sign) => london.get(sign) < 60))
assert.ok(['virgo', 'libra'].every((sign) => Math.abs(london.get(sign) - 180) < 15))
const south = ascSpans(-34)
assert.ok(['virgo', 'libra'].every((sign) => south.get(sign) === Math.min(...south.values())))

let days = 0
let sampled = 0
let sextiles = 0
let mercuryMax = 0
let venusMax = 0
const retrograde = Object.fromEntries(POINT_KEYS.map((key) => [key, 0]))
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
const start = Date.UTC(1900, 0, 1)
for (let time = start; time < Date.UTC(2027, 0, 1); time += day) {
  const points = chartPositions(time)
  for (const key of POINT_KEYS) retrograde[key] += Number(points[key].retrograde)
  mercuryMax = Math.max(mercuryMax, distance(points.sun.longitude, points.mercury.longitude))
  venusMax = Math.max(venusMax, distance(points.sun.longitude, points.venus.longitude))
  if (time >= Date.UTC(1941, 0, 1) && days % 10 === 0) {
    sampled++
    if (findAspects(points, ['neptune', 'pluto'])[0]?.aspect === 'sextile') sextiles++
  }
  days++
}
const pct = (key) => Math.round((100 * retrograde[key]) / days)
assert.deepEqual(['mercury', 'venus', 'mars'].map(pct), [19, 7, 9])
assert.match(
  birth.body,
  /Mercury was retrograde on about 19% of days, Venus on about 7% and Mars on about 9%/,
)
const outer = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(pct)
assert.deepEqual([Math.min(...outer), Math.max(...outer)], [30, 44])
assert.equal(retrograde.sun + retrograde.moon, 0)
assert.equal(retrograde.meanNode, days)
assert.ok(mercuryMax < 28 && venusMax < 48)
assert.ok(sextiles / sampled > 0.5)

console.log(
  `Natal chart: ${birth.words} / ${rising.words} words, peak section Dice ${peak.toFixed(3)}, numeric checks passed`,
)
