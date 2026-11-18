#!/usr/bin/env node
// 字号只用角色类（openspec refresh-visual-system-warm design.md D5，specs/site-visual-system「字号只用六个角色」）：
// apps/web/src 中不得出现 Tailwind 原始字号 text-xs / text-sm / text-base / text-lg / text-xl / text-2xl…text-9xl，
// 页面改用 text-display、text-title、text-subtitle、text-lead、text-body、text-caption（应用区另有 text-micro）。
// 过渡期的存量文件登记在同目录的 check-type-roles.allow.json（文件路径 → 允许的出现次数），各页面组改版时删除
// 自己文件的条目；次数只能减少。routes/dev 与测试文件不检查。
// 用法：node apps/web/scripts/check-type-roles.mjs [--write-allowlist]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const WEB_ROOT = resolve(import.meta.dirname, '..')
export const ALLOWLIST_PATH = join(import.meta.dirname, 'check-type-roles.allow.json')
// 变体前缀（sm:、hover:、[&_h2]: 等）之后的原始字号类；text-base 之后不得再接 -（避免误伤自定义类名）
const RAW_SIZE = /(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g
const EXCLUDED_DIRS = new Set(['node_modules', 'paraglide', '__snapshots__', 'generated'])

/** 一段源码中的原始字号类 */
export function rawSizes(source) {
  return source.match(RAW_SIZE) ?? []
}

/** 是否属于检查范围：src 下的 .ts / .tsx，不含测试与 routes/dev */
export function inScope(file) {
  const path = file.split(sep).join('/')
  return (
    /\.tsx?$/.test(path) &&
    !/\.(?:test|spec|gen)\.tsx?$/.test(path) &&
    !path.startsWith('src/routes/dev/') &&
    path.startsWith('src/')
  )
}

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return EXCLUDED_DIRS.has(entry.name) ? [] : files(path)
    return entry.isFile() ? [path] : []
  })
}

/** 各文件中原始字号类的出现次数（只含次数大于 0 的文件），键为相对 apps/web 的路径 */
export function scan(root = WEB_ROOT) {
  const counts = {}
  for (const path of files(join(root, 'src'))) {
    const file = relative(root, path).split(sep).join('/')
    if (!inScope(file)) continue
    const count = rawSizes(readFileSync(path, 'utf8')).length
    if (count > 0) counts[file] = count
  }
  return counts
}

/**
 * 对照允许名单：未登记的文件、超出登记次数的文件报错；
 * 已不再使用原始字号、或次数已减少的条目提示收紧名单（同样算失败，保证名单只减不增且不残留）。
 */
export function compare(counts, allowlist) {
  const errors = []
  for (const [file, count] of Object.entries(counts)) {
    const allowed = allowlist[file] ?? 0
    if (count > allowed)
      errors.push(
        allowed === 0
          ? `${file}: ${count} 处原始字号类，请改用字号角色类`
          : `${file}: ${count} 处原始字号类，超过允许名单登记的 ${allowed} 处`,
      )
  }
  for (const [file, allowed] of Object.entries(allowlist)) {
    const count = counts[file] ?? 0
    if (count < allowed)
      errors.push(
        count === 0
          ? `${file}: 已没有原始字号类，请从 check-type-roles.allow.json 删除该条目`
          : `${file}: 原始字号类已减少到 ${count} 处，请把允许名单中的 ${allowed} 改为 ${count}`,
      )
  }
  return errors.sort()
}

export function readAllowlist(path = ALLOWLIST_PATH) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const counts = scan()
  if (process.argv.includes('--write-allowlist')) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
    console.log(`已写入允许名单：${Object.keys(sorted).length} 个文件`)
  } else {
    const errors = compare(counts, readAllowlist())
    if (errors.length > 0) {
      console.error(`字号角色检查未通过（${errors.length} 项）：`)
      for (const error of errors) console.error(`  ${error}`)
      process.exit(1)
    }
    const remaining = Object.keys(readAllowlist()).length
    console.log(`字号角色检查通过：允许名单中还有 ${remaining} 个待改版的文件`)
  }
}
