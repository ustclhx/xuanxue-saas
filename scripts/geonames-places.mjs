#!/usr/bin/env node
// 把 GeoNames cities15000 切成按首字母的静态 JSON（出生地自动补全用，CC BY 4.0）。
// 用法：先从 https://download.geonames.org/export/dump/ 下载 cities15000.zip、alternateNamesV2.zip（均解压）
// 与 admin1CodesASCII.txt，然后在仓库根运行 `node scripts/geonames-places.mjs <下载目录>`，
// 并按输出更新 SOURCES.md 中的日期与 SHA-256。
import { createHash } from 'node:crypto'
import { createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import {
  isValidTimeZone,
  normalizePlaceName,
  PLACE_DATA_VERSION,
  PLACE_SLICE_KEYS,
  placeSliceKey,
} from '../packages/astro/src/places.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, `apps/web/public/geo/places/v${PLACE_DATA_VERSION}`)
// 历史、废弃、被毁的居民点不进补全。
const SKIP_FEATURES = new Set(['PPLH', 'PPLQ', 'PPLW'])
// 每个地名最多保留的额外检索名（ASCII 名 + 英文别名），控制体积。
const MAX_ALIASES = 4

const source = process.argv[2]
if (!source) {
  console.error(
    'Usage: node scripts/geonames-places.mjs <dir with cities15000.txt and admin1CodesASCII.txt>',
  )
  process.exit(1)
}

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
const lines = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean)

const admin1 = new Map(
  lines(join(source, 'admin1CodesASCII.txt')).map((line) => {
    const [code, name] = line.split('\t')
    return [code, name]
  }),
)

const rows = []
const skipped = { feature: 0, initial: 0 }
const badZones = new Set()
for (const line of lines(join(source, 'cities15000.txt'))) {
  const f = line.split('\t')
  const [id, name, ascii, lat, lon, feature, country, admin1Code, population, timeZone] = [
    f[0],
    f[1],
    f[2],
    Number(f[4]),
    Number(f[5]),
    f[7],
    f[8],
    f[10],
    Number(f[14]),
    f[17],
  ]
  if (SKIP_FEATURES.has(feature)) {
    skipped.feature++
    continue
  }
  if (!isValidTimeZone(timeZone)) {
    badZones.add(timeZone)
    continue
  }
  if (!placeSliceKey(name)) {
    skipped.initial++
    continue
  }
  rows.push({
    id,
    ascii,
    population,
    sortName: normalizePlaceName(name),
    row: [
      name,
      admin1.get(`${country}.${admin1Code}`) ?? '',
      country,
      Math.round(lat * 1e4) / 1e4,
      Math.round(lon * 1e4) / 1e4,
      timeZone,
    ],
  })
}
if (badZones.size) {
  console.error(`Time zones unknown to this runtime: ${[...badZones].join(', ')}`)
  process.exit(1)
}

// 英文别名（如 Cologne → Köln、Peking → Beijing）：alternateNamesV2 中 isolanguage 为 en 或未标语言、非俗称的名称。
// 旧称与转写（Peking、Bombay）在 GeoNames 多数未标语言；带其他语言标记（含 es）的名称不收。
// 列：alternateNameId, geonameid, isolanguage, name, isPreferred, isShort, isColloquial, isHistoric, from, to
const wanted = new Set(rows.map(({ id }) => id))
const english = new Map()
for await (const line of createInterface({
  input: createReadStream(join(source, 'alternateNamesV2.txt')),
})) {
  const f = line.split('\t')
  if ((f[2] !== 'en' && f[2] !== '') || f[6] === '1' || !wanted.has(f[1])) continue
  const list = english.get(f[1]) ?? []
  // en 首选名、en 短名、其余 en、未标语言依次排列，同级按文件顺序。
  const rank = f[2] === 'en' ? (f[4] === '1' ? 0 : f[5] === '1' ? 1 : 2) : 3
  list.push({ name: f[3], rank })
  english.set(f[1], list)
}

// 未标语言的旧称只给人口 ≥10 万的城市，且只收纯字母名称（不含撇号、连字符、数字），控制体积。
const UNTAGGED_MIN_POPULATION = 100_000
const plainName = /^[\p{L} ]+$/u

let aliasCount = 0
for (const entry of rows) {
  const candidates = [
    { name: entry.ascii, rank: -1 },
    ...(english.get(entry.id) ?? []).filter(
      ({ name, rank }) =>
        rank < 3 || (entry.population >= UNTAGGED_MIN_POPULATION && plainName.test(name)),
    ),
  ]
    .sort((a, b) => a.rank - b.rank)
    .map(({ name }) => ({ name, normalized: normalizePlaceName(name) }))
  // 前缀检索下，若主名或另一候选以某别名开头（Pekin ⊂ Peking、Beijing ⊂ Beijing Shi），较短者可删：
  // 查询较短者时仍能命中较长者。主名以候选开头时候选也多余。
  const kept = []
  for (const candidate of candidates) {
    const { normalized } = candidate
    if (!placeSliceKey(normalized) || normalized.startsWith(entry.sortName)) continue
    if (entry.sortName.startsWith(normalized)) continue
    if (kept.some((other) => other.normalized.startsWith(normalized))) continue
    const longer = kept.findIndex((other) => normalized.startsWith(other.normalized))
    if (longer >= 0) kept[longer] = candidate
    else if (kept.length < MAX_ALIASES) kept.push(candidate)
  }
  entry.aliases = kept.map(({ name }) => name)
  aliasCount += kept.length
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
let bytes = 0
let gzipBytes = 0
let largest = { key: '', bytes: 0, gzip: 0 }
let entries = 0
for (const key of PLACE_SLICE_KEYS) {
  // 地名进入其主名与每个别名首字母对应的切片；切片内只带首字母相符的别名。
  const slice = rows
    .map((entry) => ({
      entry,
      aliases: entry.aliases.filter((alias) => placeSliceKey(alias) === key),
    }))
    .filter(({ entry, aliases }) => placeSliceKey(entry.row[0]) === key || aliases.length > 0)
    // 人口降序；同人口按名称，保证输出稳定。
    .sort(
      (a, b) =>
        b.entry.population - a.entry.population || a.entry.sortName.localeCompare(b.entry.sortName),
    )
  const zones = [...new Set(slice.map(({ entry }) => entry.row[5]))].sort()
  const index = new Map(zones.map((zone, i) => [zone, i]))
  const body = `${JSON.stringify({
    v: PLACE_DATA_VERSION,
    key,
    tz: zones,
    places: slice.map(({ entry: { row }, aliases }) => [
      ...row.slice(0, 5),
      index.get(row[5]),
      ...(aliases.length ? [aliases] : []),
    ]),
  })}\n`
  writeFileSync(join(outDir, `${key}.json`), body)
  entries += slice.length
  const size = Buffer.byteLength(body)
  const gzip = gzipSync(body, { level: 9 }).length
  bytes += size
  gzipBytes += gzip
  if (size > largest.bytes) largest = { key, bytes: size, gzip }
}

console.log(
  JSON.stringify(
    {
      places: rows.length,
      sliceEntries: entries,
      aliases: aliasCount,
      skipped,
      bytes,
      gzipBytes,
      largest,
      sha256: {
        'cities15000.txt': await sha256(join(source, 'cities15000.txt')),
        'admin1CodesASCII.txt': await sha256(join(source, 'admin1CodesASCII.txt')),
        'alternateNamesV2.txt': await sha256(join(source, 'alternateNamesV2.txt')),
      },
    },
    null,
    2,
  ),
)
