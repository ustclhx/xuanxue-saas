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
import remarkGfm from 'remark-gfm'
import { z } from 'zod'
import templateConfig from '../../template.config.ts'
import { contentParents, sitePathPattern } from './src/features/seo/content-parents.ts'
import { TAROT_LOCALES } from './src/features/tools/tarot/routes.ts'

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
  const code = await compileMDX(context, document, { remarkPlugins: [remarkGfm] })
  const scope = { React, ReactDOM, _jsx_runtime: jsxRuntime }
  const Component = new Function(...Object.keys(scope), code)(...Object.values(scope)).default
  return renderToStaticMarkup(
    React.createElement(Component, {
      components: {
        // 保留原生表格语义；宽表只在自身容器内滚动，并允许键盘聚焦滚动。
        table: ({ children, ...props }: React.ComponentProps<'table'>) =>
          React.createElement(
            'div',
            { className: 'rich-table-scroll', tabIndex: 0, role: 'group' },
            React.createElement('table', props, children),
          ),
        // 代码块（如数字学算例）在窄屏横向滚动：同样允许键盘聚焦后滚动（axe scrollable-region-focusable）
        pre: (props: React.ComponentProps<'pre'>) =>
          React.createElement('pre', { ...props, tabIndex: 0 }),
      },
    }),
  )
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

/**
 * 内链字段（openspec seo-internal-linking）：`parent` 省略时取集合的列表页，`anchor_short` 为锚文本短变体，
 * `related` 为相关页地址。地址写不带语言前缀的站内 path，构建时校验目标存在且可索引。
 */
const sitePath = z.string().regex(sitePathPattern, 'must be a site path starting with /')
const linking = {
  parent: sitePath.optional(),
  anchor_short: z.string().trim().min(1).optional(),
  related: z.array(sitePath).default([]),
}

/**
 * 博客文章的 frontmatter。`cover` 与 `coverAlt` 供列表卡片使用（设计稿 warm-refresh/BlogList.dc.html）：
 * 有封面图就必须写替代文字，缺少时该文档校验失败、不进入构建产物。
 */
export const postSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    /** 发布时间（ISO 日期或日期时间）；晚于当前时间的文章在到期前不出现 */
    date: isoDate,
    /** 封面图的站内路径（自托管，如 `/images/blog/<slug>.webp`，16:9）；省略时列表显示生成封面 */
    cover: z
      .string()
      .regex(/^\/(?!\/)/, 'cover must be a site-relative path such as /images/blog/post.webp')
      .optional(),
    /** 封面图的替代文字；有 cover 时必填 */
    coverAlt: z.string().min(1).optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    ...linking,
    content: z.string(),
  })
  .refine((post) => !post.cover || Boolean(post.coverAlt), {
    path: ['coverAlt'],
    message: 'coverAlt is required when cover is set',
  })

const posts = defineCollection({
  name: 'posts',
  directory: 'content/blog',
  include: '*/**/*.mdx',
  schema: postSchema,
  transform: async (document, context) => {
    if (!templateConfig.features.blog) return context.skip('features.blog=false')
    if (document.draft && !includeDrafts) return context.skip('draft')
    const { content, ...data } = document
    return {
      ...data,
      parent: data.parent ?? contentParents.posts,
      ...localeAndSlug(document._meta),
      html: await renderMdx(context, document),
    }
  },
})

/**
 * 两站共用的「运营主体与共享账户」段落（product-improve-ai-content D4）：每种语言只写一份，
 * 法律页正文中的 `{{operatorNotice}}` 在构建期替换为它，两站引用同一来源。
 */
const legalShared = defineCollection({
  name: 'legalShared',
  directory: 'content/legal/shared',
  include: '*/*.mdx',
  schema: z.object({ content: z.string() }),
})

/**
 * 法律页按站点分开（content/legal/<site>/<locale>/<slug>.mdx）：东方站只描述八字、四柱、紫微与塔罗，
 * 西方站只描述数字命理与塔罗；运营主体段落来自 legalShared。
 */
const legalPages = defineCollection({
  name: 'legalPages',
  directory: 'content/legal',
  include: ['east/*/*.mdx', 'west/*/*.mdx'],
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedAt: isoDate,
    ...linking,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const [site = '', ...rest] = document._meta.path.split('/')
    const { locale, slug } = localeAndSlug({ ...document._meta, path: rest.join('/') })
    const shared = context
      .documents(legalShared)
      .find((entry) => localeAndSlug(entry._meta).locale === locale)
    if (content.includes('{{operatorNotice}}') && !shared)
      throw new Error(`Missing shared operator notice for ${locale}: ${document._meta.path}`)
    const body = content.replaceAll('{{operatorNotice}}', shared?.content.trim() ?? '')
    return {
      ...data,
      site,
      parent: data.parent ?? contentParents.legal,
      locale,
      slug,
      title: fillPlaceholders(data.title),
      description: fillPlaceholders(data.description),
      // 联系邮箱按站点在渲染时替换（东方站 support@ganjiday.com），这里先换成纯文本标记
      html: await renderMdx(context, {
        ...document,
        content: fillPlaceholders(body, { supportEmail: SUPPORT_EMAIL_TOKEN }),
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
    ...linking,
    content: z.string(),
  }),
  transform: async (document, context) => {
    // 文档站关闭时内容不进入构建产物，路由同时返回 404（tasks.md 3.4）
    if (!templateConfig.features.docs) return context.skip('features.docs=false')
    if (document.requires && !templateConfig.features[document.requires])
      return context.skip(`features.${document.requires}=false`)
    const { content, requires: _requires, ...data } = document
    const html = await renderMdx(context, {
      ...document,
      content: fillPlaceholders(content),
    })
    // 构建期生成的搜索文本，客户端按它做全文匹配（design.md 决策 1）
    return {
      ...data,
      parent: data.parent ?? contentParents.docs,
      ...localeAndSlug(document._meta),
      html,
      searchText: plainText(html),
    }
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
    // 页面 H1；省略时与 title 相同（与 tarot 同名字段；新语言按关键词地图让 Title 与 H1 用不同主词）
    heading: z.string().min(1).optional(),
    description: z.string(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
    updated: isoDate,
    number: z.number().int().nullable(),
    // 数字页组件段的逐数字文案（openspec content-growth-phase1 决策 1、4）：首屏样例说明与「其余数字」一段，
    // `neighbors` 用 `[锚文本]` 标出链接位置；缺失时组件沿用 messages 文案
    sample_note: z.string().min(1).optional(),
    neighbors: z.string().min(1).optional(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const body = content.split(/^## (?:FAQ|Preguntas frecuentes)\s*$/m)[0] ?? content
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
    // 页面 H1；省略时与 title 相同（关键词地图为 ja 另定 H1，add-locales-eu-ja 任务 4.2）
    heading: z.string().min(1).optional(),
    description: z.string().min(1).max(160),
    // 组件段逐牌文案（openspec content-growth-phase1 决策 1–3）：页头导语、抽一张说明、延伸牌义说明。
    // 可选：缺失时页面沿用 description 与 messages 的通用句，东方站与 ja 不受影响。
    lede: z.string().min(1).optional(),
    try_prompt: z.string().min(1).optional(),
    related_note: z.string().min(1).optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    // 塔罗在全部语言提供（openspec add-locales-eu-ja tasks 1.3）
    locale: z.enum(TAROT_LOCALES),
    cardId: z.string(),
    arcana: z.enum(['major', 'minor']),
    suit: z.enum(['wands', 'cups', 'swords', 'pentacles']).optional(),
    updated: isoDate,
    // origin：FAQ 是否取自本语言用户的真实问法（localized-content-quality「FAQ 与示例的本地化」）
    faq: z
      .array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
          origin: z.enum(['local', 'adapted']).optional(),
        }),
      )
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

/**
 * 东方站根路径英文的 78 张「as feelings」牌页（openspec add-locales-eu-ja 5b，关键词地图方案 A）：
 * 独立内容源，不复用 content/tarot/en（西方站英文牌义），跨站相似度门槛按同类页比较。
 * 正文不含 FAQ、链接与文末声明：FAQ 由页面按 frontmatter 渲染（与 FAQPage 同源），链接由页面模板给出。
 */
const tarotFeelings = defineCollection({
  name: 'tarotFeelings',
  directory: 'content/tarot-feelings',
  include: 'en/*.mdx',
  schema: z.object({
    title: z.string().min(1).max(49),
    description: z.string().min(1).max(160),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    locale: z.literal('en'),
    cardId: z.string(),
    arcana: z.enum(['major', 'minor']),
    suit: z.enum(['wands', 'cups', 'swords', 'pentacles']).optional(),
    updated: isoDate,
    faq: z
      .array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
          origin: z.enum(['local', 'adapted']),
        }),
      )
      .min(3)
      .max(5)
      .refine((items) => items.filter((item) => item.origin === 'local').length >= 2, {
        message: 'at least 2 FAQ questions must be local',
      }),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const path = localeAndSlug(document._meta)
    const card = CARDS.find((card) => card.id === data.cardId)
    if (!card || card.slug !== data.slug || path.slug !== data.cardId)
      throw new Error(`Invalid tarot feelings identity: ${document._meta.path}`)
    if (/\]\(|<a\b|^##\s*FAQ/im.test(content))
      throw new Error(
        `Tarot feelings body must not contain links or a FAQ section: ${document._meta.path}`,
      )
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
    // 八字概念页只在 v1 东方站语言提供（ja 延后，design 决策 4）；加语言时显式加入
    locale: z.enum(['zh-Hant', 'zh-Hans', 'ko']),
    aliases: z
      .array(
        z
          .string()
          .min(1)
          .regex(/^[^/\s]+$/),
      )
      .default([]),
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
    const body = content.split(/^## (?:常見問題|常见问题|자주 묻는 질문)\s*$/m)[0] ?? content
    const html = await renderMdx(context, { ...document, content: body })
    if (plainText(html).replace(/\s/g, '').length < 600)
      throw new Error(`Concept body must contain at least 600 characters: ${document._meta.path}`)
    return { ...data, html }
  },
})

/**
 * 黄历工具页与 12 个月份页的逐页文案（openspec content-growth-phase2 决策 5、第 6 组）：
 * `index.mdx` 是工具页的说明长文，`<m>.mdx` 是 m 月的导语、节气说明、宜忌读法（正文）与 FAQ。
 * 月份页网址不带年份，年份、节气时刻与逐日数据由页面按参考日期计算，文案不写具体年份与日期。
 * 构建期拦下婚嫁类与吉凶断语类措辞（design「约束」）：嫁娶只作为逐日表里的普通词条出现，不进入撰写文案。
 */
const ALMANAC_BANNED =
  /嫁娶|结婚|婚嫁|婚配|合婚|配对|纳采|订婚|订盟|吉日|娱乐|运势|大吉|大凶|\bAI\b/
const almanacFaq = z.array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
const almanac = defineCollection({
  name: 'almanac',
  directory: 'content/almanac',
  include: '*/*.mdx',
  schema: z.object({
    month: z.number().int().min(1).max(12).optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    lede: z.string().min(1).optional(),
    terms_note: z.string().min(1).optional(),
    faq: almanacFaq.min(2).max(4),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug } = localeAndSlug(document._meta)
    // index.mdx 的 _meta.path 是目录本身（slug 为空）
    const isTool = slug === '' || slug === 'index'
    if (isTool ? data.month !== undefined : data.month !== Number(slug))
      throw new Error(`Almanac month does not match file name: ${document._meta.path}`)
    if (isTool && !(data.title && data.description && data.intro))
      throw new Error(
        `Almanac tool page needs title, description and intro: ${document._meta.path}`,
      )
    if (!isTool && !(data.lede && data.terms_note))
      throw new Error(`Almanac month page needs lede and terms_note: ${document._meta.path}`)
    const text = [
      data.title,
      data.description,
      data.intro,
      data.lede,
      data.terms_note,
      content,
      ...data.faq.flatMap(({ q, a }) => [q, a]),
    ].join('\n')
    const banned = ALMANAC_BANNED.exec(text)
    if (banned) throw new Error(`Almanac copy contains「${banned[0]}」: ${document._meta.path}`)
    const html = await renderMdx(context, document)
    const minimum = isTool ? 1200 : 150
    if (plainText(html).replace(/[^\p{Script=Han}]/gu, '').length < minimum)
      throw new Error(
        `Almanac body must contain at least ${minimum} characters: ${document._meta.path}`,
      )
    // terms_note 允许用空行分段
    const termsNote = (data.terms_note ?? '')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, ''))
      .filter(Boolean)
    return { ...data, locale, key: isTool ? 'tool' : String(data.month), termsNote, html }
  },
})

const guides = defineCollection({
  name: 'guides',
  directory: 'content/guides',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    /** 结论：页面置顶显示，也是 meta description */
    answer_summary: z.string().min(1),
    /** 同时渲染为页面 FAQ 与 FAQPage JSON-LD */
    faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(1),
    kind: z.enum(['how-to', 'is-it-free', 'trends']),
    updatedAt: isoDate,
    draft: z.boolean().default(false),
    ...linking,
    content: z.string(),
  }),
  transform: async (document, context) => {
    if (!templateConfig.features.guides) return context.skip('features.guides=false')
    if (document.draft && !includeDrafts) return context.skip('draft')
    const { content, ...data } = document
    return {
      ...data,
      parent: data.parent ?? contentParents.guides,
      ...localeAndSlug(document._meta),
      html: await renderMdx(context, document),
    }
  },
})

export default defineConfig({
  content: [
    posts,
    legalShared,
    legalPages,
    docs,
    numerology,
    tarot,
    tarotFeelings,
    concepts,
    almanac,
    guides,
  ],
})
