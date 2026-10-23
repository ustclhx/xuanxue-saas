// 内容方案（openspec add-marketing-i18n-seo design.md 决策 1）：仓库中的 MDX 文件经 content-collections
// 校验 frontmatter 并生成类型化数据，由 `content-collections` 别名引用（vite.config.ts 的插件生成）。
//
// 目录约定：content/<集合>/<locale>/<slug>.mdx，locale 与 slug 由文件路径得到。
// MDX 在构建期渲染为 HTML（Worker 中不允许 `new Function` 执行 MDX 编译结果），页面直接输出 HTML。
import { defineCollection, defineConfig, type Meta } from '@content-collections/core'
import { compileMDX } from '@content-collections/mdx'
import { CARDS } from '@xuanxue/tarot'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as ReactDOM from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { z } from 'zod'
import templateConfig from '../../template.config.ts'

/**
 * 是否保留草稿：`vite dev` 中显示草稿便于预览，生产构建（NODE_ENV=production）直接跳过，
 * 草稿不会进入构建产物（specs/marketing-site「博客」）。CONTENT_DRAFTS=1 可在构建中强制保留。
 */
const includeDrafts = process.env.CONTENT_DRAFTS === '1' || process.env.NODE_ENV !== 'production'

/** 由 `<locale>/<slug...>` 形式的路径得到语言与 slug */
function localeAndSlug(meta: Meta): { locale: string; slug: string } {
  const [locale = '', ...rest] = meta.path.split('/')
  return { locale, slug: rest.join('/') }
}

type CompileContext = Parameters<typeof compileMDX>[0]

/** MDX → 静态 HTML（构建期在 Node 中执行） */
async function renderMdx(context: CompileContext, document: { _meta: Meta; content: string }) {
  const code = await compileMDX(context, document)
  const scope = { React, ReactDOM, _jsx_runtime: jsxRuntime }
  const Component = new Function(...Object.keys(scope), code)(...Object.values(scope)).default
  return renderToStaticMarkup(React.createElement(Component))
}

/** 搜索索引用的纯文本：去掉标签并合并空白 */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 法律页与文档中的 `{{key}}` 占位符按模板配置替换（站点名称与地址、支持邮箱、可申请退款的天数），
 * 新站点改配置即可，不必逐页修改文案。
 */
// 与 src/features/marketing/legal-tokens.ts 的 SUPPORT_EMAIL_TOKEN 相同（legal-pages.test.ts 校验）；
// 本文件会被测试复制到临时目录运行，因此不引用 src 下的模块
const SUPPORT_EMAIL_TOKEN = '%SUPPORT_EMAIL%'

const legalPlaceholders: Record<string, string> = {
  appName: templateConfig.app.name,
  appUrl: templateConfig.app.url.replace(/\/+$/, ''),
  supportEmail: templateConfig.app.supportEmail,
  refundWindowDays: String(templateConfig.billing.refundWindowDays),
}

export function fillPlaceholders(text: string, overrides: Record<string, string> = {}): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) => overrides[key] ?? legalPlaceholders[key] ?? match,
  )
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/)

const posts = defineCollection({
  name: 'posts',
  directory: 'content/blog',
  include: '*/**/*.mdx',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** 发布时间（ISO 日期或日期时间）；晚于当前时间的文章在到期前不出现 */
    date: isoDate,
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    content: z.string(),
  }),
  transform: async (document, context) => {
    if (!templateConfig.features.blog) return context.skip('features.blog=false')
    if (document.draft && !includeDrafts) return context.skip('draft')
    const { content, ...data } = document
    return { ...data, ...localeAndSlug(document._meta), html: await renderMdx(context, document) }
  },
})

const legalPages = defineCollection({
  name: 'legalPages',
  directory: 'content/legal',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedAt: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    return {
      ...data,
      ...localeAndSlug(document._meta),
      title: fillPlaceholders(data.title),
      description: fillPlaceholders(data.description),
      // 联系邮箱按站点在渲染时替换（东方站 support@ganjiday.com），这里先换成纯文本标记
      html: await renderMdx(context, {
        ...document,
        content: fillPlaceholders(content, { supportEmail: SUPPORT_EMAIL_TOKEN }),
      }),
    }
  },
})

const docs = defineCollection({
  name: 'docs',
  directory: 'content/docs',
  include: '*/**/*.mdx',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** 侧边导航中的分组；order 为全站顺序，分组按其第一篇出现的位置排列 */
    section: z.string(),
    order: z.number().default(0),
    /** 依赖的功能开关：对应开关关闭时该页不进入构建产物（如公开 API 文档依赖 features.publicApi） */
    requires: z.enum(['publicApi']).optional(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    // 文档站关闭时内容不进入构建产物，路由同时返回 404（tasks.md 3.4）
    if (!templateConfig.features.docs) return context.skip('features.docs=false')
    if (document.requires && !templateConfig.features[document.requires])
      return context.skip(`features.${document.requires}=false`)
    const { content, requires: _requires, ...data } = document
    const html = await renderMdx(context, { ...document, content: fillPlaceholders(content) })
    // 构建期生成的搜索文本，客户端按它做全文匹配（design.md 决策 1）
    return { ...data, ...localeAndSlug(document._meta), html, searchText: plainText(html) }
  },
})

/**
 * 数字命理页正文（openspec add-numerology-tools design.md 决策 2）：12 个生命灵数页、两个枢纽页与首页长文。
 * `number` 为生命灵数，枢纽页与首页为 null。正文末尾的「## FAQ」及之后的互链、声明由页面组件
 * 统一渲染（ToolFaq、数字网格、Disclaimer），这里只编译 FAQ 之前的部分，FAQ 以 frontmatter 为准。
 */
const numerology = defineCollection({
  name: 'numerology',
  directory: 'content/numerology',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
    updated: isoDate,
    number: z.number().int().nullable(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const body = content.split(/^## FAQ\s*$/m)[0] ?? content
    return {
      ...data,
      ...localeAndSlug(document._meta),
      html: await renderMdx(context, { ...document, content: body }),
    }
  },
})

/** 牌义长文只在构建期编译；保留可见 FAQ 与文末声明，页面不重复渲染。 */
const tarot = defineCollection({
  name: 'tarot',
  directory: 'content/tarot',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1).max(160),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    locale: z.enum(['en', 'zh-Hant', 'zh-Hans', 'ko']),
    cardId: z.string(),
    arcana: z.enum(['major', 'minor']),
    suit: z.enum(['wands', 'cups', 'swords', 'pentacles']).optional(),
    updated: isoDate,
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(5),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const path = localeAndSlug(document._meta)
    const card = CARDS.find((card) => card.id === data.cardId)
    if (
      !card ||
      card.slug !== data.slug ||
      path.locale !== data.locale ||
      path.slug !== data.cardId
    )
      throw new Error(`Invalid tarot identity: ${document._meta.path}`)
    return { ...data, html: await renderMdx(context, document) }
  },
})

const concepts = defineCollection({
  name: 'concepts',
  directory: 'content/concepts',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[^/\s]+$/),
    locale: z.enum(['zh-Hant', 'zh-Hans', 'ko']),
    conceptKey: z.enum([
      'luck',
      'useful-god',
      'elements',
      'strength',
      'void',
      'shensha',
      'weight',
      'ten-gods',
      'day-pillar',
    ]),
    block: z.enum([
      'pillars',
      'elements',
      'strength',
      'useful-god',
      'luck',
      'shensha',
      'weight',
      'ten-gods',
    ]),
    faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(1),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    if (localeAndSlug(document._meta).locale !== data.locale)
      throw new Error(`Concept locale does not match directory: ${document._meta.path}`)
    // FAQ 和内链由 ToolPage 统一展示；正文沿用仓库内容，不重复尾部模板。
    const body = content.split(/^## (?:常見問題|자주 묻는 질문)\s*$/m)[0] ?? content
    const html = await renderMdx(context, { ...document, content: body })
    if (plainText(html).replace(/\s/g, '').length < 600)
      throw new Error(`Concept body must contain at least 600 characters: ${document._meta.path}`)
    return { ...data, html }
  },
})

export default defineConfig({ content: [posts, legalPages, docs, numerology, tarot, concepts] })
