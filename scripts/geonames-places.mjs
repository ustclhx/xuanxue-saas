#!/usr/bin/env node
// 把 GeoNames cities15000 切成按首字母的静态 JSON（出生地自动补全用，CC BY 4.0）。
// 用法：先从 https://download.geonames.org/export/dump/ 下载 cities15000.zip（解压）与 admin1CodesASCII.txt，
// 然后在仓库根运行 `node scripts/geonames-places.mjs <下载目录>`，并按输出更新 SOURCES.md 中的日期与 SHA-256。
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const source = process.argv[2]
if (!source) {
  console.error(
    'Usage: node scripts/geonames-places.mjs <dir with cities15000.txt and admin1CodesASCII.txt>',
  )
  process.exit(1)
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
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
  const [name, lat, lon, feature, country, admin1Code, population, timeZone] = [
    f[1],
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
  const key = placeSliceKey(name)
  if (!key) {
    skipped.initial++
    continue
  }
  rows.push({
    key,
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

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
let total = 0
let bytes = 0
let largest = { key: '', bytes: 0 }
for (const key of PLACE_SLICE_KEYS) {
  const slice = rows
    .filter((entry) => entry.key === key)
    // 人口降序；同人口按名称，保证输出稳定。
    .sort((a, b) => b.population - a.population || a.sortName.localeCompare(b.sortName))
  const zones = [...new Set(slice.map(({ row }) => row[5]))].sort()
  const index = new Map(zones.map((zone, i) => [zone, i]))
  const body = `${JSON.stringify({
    v: PLACE_DATA_VERSION,
    key,
    tz: zones,
    places: slice.map(({ row }) => [...row.slice(0, 5), index.get(row[5])]),
  })}\n`
  writeFileSync(join(outDir, `${key}.json`), body)
  total += slice.length
  bytes += Buffer.byteLength(body)
  if (Buffer.byteLength(body) > largest.bytes) largest = { key, bytes: Buffer.byteLength(body) }
}

console.log(
  JSON.stringify(
    {
      places: total,
      skipped,
      bytes,
      largest,
      sha256: {
        'cities15000.txt': sha256(join(source, 'cities15000.txt')),
        'admin1CodesASCII.txt': sha256(join(source, 'admin1CodesASCII.txt')),
      },
    },
    null,
    2,
  ),
)
