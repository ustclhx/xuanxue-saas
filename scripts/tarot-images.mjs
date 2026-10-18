#!/usr/bin/env node
// 需安装 cwebp（macOS: brew install webp）；只从 Commons 的 1909 扫描系列下载。
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'apps/web/public/tarot')
const agent = 'XuanxueTarotAssets/1.0 (https://github.com/ustclhx/xuanxue-saas)'
async function get(url) {
  let response
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {
      headers: { 'User-Agent': agent },
      signal: AbortSignal.timeout(60000),
    })
    if (response.status !== 429) break
    await response.body?.cancel()
    await new Promise((resolve) => setTimeout(resolve, 15000 * (attempt + 1)))
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
  return response
}
const api = (params) =>
  `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', ...params })}`
const listing = await (
  await get(api({ list: 'allimages', aiprefix: 'RWS1909', ailimit: '100' }))
).json()
const originals = listing.query.allimages
if (originals.length !== 78) throw new Error(`Expected 78 scans, got ${originals.length}`)
const files = []
for (let start = 0; start < originals.length; start += 39) {
  const metadata = await (
    await get(
      api({
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        titles: originals
          .slice(start, start + 39)
          .map((file) => `File:${file.name}`)
          .join('|'),
      }),
    )
  ).json()
  files.push(...Object.values(metadata.query.pages))
}
await mkdir(output, { recursive: true })
const temporary = await mkdtemp(join(tmpdir(), 'tarot-images-'))
const rows = []
try {
  for (const file of files.sort((a, b) => a.title.localeCompare(b.title))) {
    const info = file.imageinfo[0]
    const meta = info.extmetadata
    if (
      !/public domain/i.test(meta.LicenseShortName?.value ?? '') ||
      !/1909/.test(meta.DateTimeOriginal?.value ?? '') ||
      !/Pamela Colman Smith/.test(meta.Artist?.value ?? '')
    ) {
      throw new Error(`Unverified author/date/license: ${file.title}`)
    }
    const name = file.title.replace('File:RWS1909 - ', '').replace('.jpeg', '')
    const major = /^(\d+) (.+)$/.exec(name)
    const minor = /^(Cups|Pentacles|Swords|Wands) (\d+)$/.exec(name)
    const id = major ? `major-${major[1]}` : minor ? `${minor[1].toLowerCase()}-${minor[2]}` : null
    if (!id) throw new Error(`Unexpected filename: ${name}`)
    const url = new URL(info.url)
    url.search = ''
    if (url.hostname !== 'upload.wikimedia.org') throw new Error('Unexpected image host')
    const bytes = Buffer.from(await (await get(url)).arrayBuffer())
    const source = join(temporary, `${id}.jpeg`)
    await writeFile(source, bytes)
    for (const width of [240, 480]) {
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        '-resize',
        String(width),
        '0',
        source,
        '-o',
        join(output, `${id}-${width}.webp`),
      ])
    }
    const page = `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.title.replaceAll(' ', '_'))}`
    rows.push(
      `| ${id} | [Commons source](${page}) · [original scan](${url}) | Public domain (PD-old-70-expired; PDM 1.0) | ${createHash('sha256').update(bytes).digest('hex')} |`,
    )
    console.log(`${rows.length}/78 ${id}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  const webp = (await readdir(output)).filter((name) => name.endsWith('.webp'))
  if (webp.length !== 156 || rows.length !== 78) throw new Error('Incomplete asset set')
  await writeFile(
    join(output, 'SOURCES.md'),
    `# Rider–Waite–Smith 图片来源\n\n全部牌面为 Pamela Colman Smith 绘制、1909 年 Roses & Lilies 版，由 Saskia Jansen 扫描；原图与逐图许可见下表。Commons 标注 PD-old-70-expired / Public Domain Mark 1.0，作品在来源国及美国均已进入公有领域。\n\n复现：安装 cwebp 后，在仓库根运行 \`node scripts/tarot-images.mjs\`。脚本逐图核验作者、1909 年与公有领域元数据，并生成 240w / 480w WebP；SHA-256 固定本次使用的原始字节，可发现上游文件变化。\n\n| Card ID | 来源 URL | 许可 | 原图 SHA-256 |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`,
  )
  console.log(`Verified ${webp.length} WebP files and ${rows.length} source records`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
