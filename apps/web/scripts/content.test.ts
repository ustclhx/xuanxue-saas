import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createBuilder } from '@content-collections/core'
import { afterAll, describe, expect, it } from 'vitest'

// 草稿不进入生产构建（openspec add-marketing-i18n-seo tasks.md 3.3，specs/marketing-site「博客」）：
// 按生产构建的 NODE_ENV 生成内容到临时目录，检查生成的数据里没有草稿；开发环境则保留草稿供预览。
const configPath = new URL('../content-collections.ts', import.meta.url).pathname
const appRoot = new URL('..', import.meta.url).pathname
// 编译后的配置从这里解析依赖，临时目录需位于 apps/web 下（.content-collections 已 gitignore）
const tempRoot = new URL('../.content-collections/test', import.meta.url).pathname
const outputs: string[] = []
const templateSlugs = ['draft-example', 'scheduled-example', 'welcome', 'writing-posts']

async function buildPosts(nodeEnv: string): Promise<{ slug: string; draft: boolean }[]> {
  mkdirSync(tempRoot, { recursive: true })
  const outputDir = mkdtempSync(join(tempRoot, 'build-'))
  outputs.push(outputDir)
  // 构建真实集合配置的临时副本，只固定博客开关；不改生成项目本身的配置。
  const fixturePath = join(outputDir, 'content-collections.ts')
  const fixture = readFileSync(configPath, 'utf8')
    .replace(
      "import templateConfig from '../../template.config.ts'",
      `import { defineTemplateConfig } from '@xuanxue/config'
const templateConfig = defineTemplateConfig({
  app: { name: 'Content test', url: 'https://content.example', supportEmail: 'support@content.example' },
  features: { blog: true },
})`,
    )
    .replaceAll("directory: 'content/", `directory: '${relative(outputDir, appRoot)}/content/`)
  writeFileSync(fixturePath, fixture)
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv
  try {
    const builder = await createBuilder(fixturePath, {
      configName: 'content-collection-config.mjs',
      outputDir,
      cacheDir: join(outputDir, 'cache'),
    })
    await builder.build()
  } finally {
    process.env.NODE_ENV = previous
  }
  const source = readFileSync(join(outputDir, 'allPosts.js'), 'utf8')
  return JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1))
}

afterAll(() => {
  for (const dir of outputs) rmSync(dir, { recursive: true, force: true })
})

describe('博客草稿', () => {
  it('生产构建中不包含草稿', async () => {
    const posts = await buildPosts('production')
    expect(posts.filter((post) => post.draft)).toEqual([])
    expect(posts.filter((post) => templateSlugs.includes(post.slug))).toEqual([])
    // 整套内容集合（含三语牌义与概念页）真实构建，CI 上超过默认 5 秒
  }, 60_000)

  it('开发环境保留草稿供预览', async () => {
    const posts = await buildPosts('development')
    for (const slug of templateSlugs)
      expect(posts.some((post) => post.draft && post.slug === slug)).toBe(true)
  }, 60_000)
})
