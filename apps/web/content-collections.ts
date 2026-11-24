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
 * zh-Hant 農民曆（content-growth-v2-tools 第 18 组）用同一集合，`content/almanac/zh-Hant`；繁体写法一并拦下，
 * 也不写「擇日」「自我探索」。月份页的撰写正文（导语、节气说明、读法）合计至少 600 字（决策 16）。
 */
const ALMANAC_BANNED =
  /嫁娶|结婚|結婚|婚嫁|婚配|合婚|配对|配對|纳采|納采|订婚|訂婚|订盟|訂盟|吉日|娱乐|娛樂|运势|運勢|大吉|大凶|擇日|自我探索|\bAI\b/
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
    const han = (value: string) => value.replace(/[^\p{Script=Han}]/gu, '').length
    if (han(plainText(html)) < minimum)
      throw new Error(
        `Almanac body must contain at least ${minimum} characters: ${document._meta.path}`,
      )
    if (
      locale === 'zh-Hant' &&
      !isTool &&
      han(plainText(html)) + han(data.lede ?? '') + han(data.terms_note ?? '') < 600
    )
      throw new Error(
        `農民曆 month copy must contain at least 600 characters: ${document._meta.path}`,
      )
    // terms_note 允许用空行分段
    const termsNote = (data.terms_note ?? '')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, ''))
      .filter(Boolean)
    return { ...data, locale, key: isTool ? 'tool' : String(data.month), termsNote, html }
  },
})

/**
 * 年度太歲页（openspec content-growth-v2-tools 决策 10，第 18 组）：content/tai-sui-year/<locale>/<年份>.mdx。
 * 值、沖、刑、害、破的生肖与出生年份表由页面按 `zodiacYearFacts` 计算，这里只放逐页撰写的文字：
 * `table_note`（表格导语）与正文（`## ` 小节）。安太歲只作民俗说明：不写化解方法、法會或點燈報名、商品，
 * 也不给吉凶断语（构建期拦下）。正文、导语与表格导语合计至少 1,200 字（决策 16）。
 */
const TAI_SUI_YEAR_BANNED =
  /化解|法會|法会|點燈|点灯|報名|报名|購買|购买|商品|開運|开运|吉日|運勢|运势|娛樂|娱乐|大吉|大凶|自我探索|嫁娶|結婚|\bAI\b/
const taiSuiYear = defineCollection({
  name: 'taiSuiYear',
  directory: 'content/tai-sui-year',
  include: '*/*.mdx',
  schema: z.object({
    year: z.number().int().min(2000).max(2100),
    title: z.string().min(1),
    description: z.string().min(1),
    heading: z.string().min(1),
    lede: z.string().min(1),
    table_note: z.string().min(1),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(5),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug } = localeAndSlug(document._meta)
    if (String(data.year) !== slug)
      throw new Error(`Tai Sui year does not match file name: ${document._meta.path}`)
    const text = [
      data.title,
      data.description,
      data.heading,
      data.lede,
      data.table_note,
      content,
      ...data.faq.flatMap(({ q, a }) => [q, a]),
    ].join('\n')
    const banned = TAI_SUI_YEAR_BANNED.exec(text)
    if (banned) throw new Error(`Tai Sui copy contains「${banned[0]}」: ${document._meta.path}`)
    const html = await renderMdx(context, document)
    const han = (value: string) => value.replace(/[^\p{Script=Han}]/gu, '').length
    if (han(plainText(html)) + han(data.lede) + han(data.table_note) < 1200)
      throw new Error(`Tai Sui copy must contain at least 1200 characters: ${document._meta.path}`)
    return { ...data, locale, key: slug, html }
  },
})

/**
 * 东方站生肖集合（openspec content-growth-phase2 决策 4，第 4 组建 schema，第 5、9 组只加内容文件）：
 * content/zodiac/<locale>/<地支 key>.mdx 为子页，index.mdx 为枢纽页。年份表、关系表与流年关系由页面按引擎计算，
 * 这里只保存逐页撰写的文字：`years_note`（年份表导语）、`relations_note`（关系表导语）、
 * `annual`（以干支年为键的流年说明，缺少的年份页面只列关系名）。
 * 正文按 `## ` 切成若干段分别编译，页面在指定段之后插入表格组件（features/east-content/zodiac/）。
 */
const ZODIAC_BRANCHES = [
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
] as const

const zodiac = defineCollection({
  name: 'zodiac',
  directory: 'content/zodiac',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    slug: z
      .string()
      .min(1)
      .regex(/^[^/\s]+$/),
    // en：东方站根路径英文只有枢纽 `/chinese-zodiac`（content-growth-v2-tools 第 11 组）
    locale: z.enum(['zh-Hans', 'ko', 'zh-Hant', 'en']),
    // 枢纽页没有地支
    branch: z.enum(ZODIAC_BRANCHES).optional(),
    lede: z.string().min(1),
    years_note: z.string().min(1).optional(),
    relations_note: z.string().min(1).optional(),
    annual: z
      .record(
        z.string().regex(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/),
        z.string().min(1),
      )
      .default({}),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    // content-collections 把 index.mdx 的路径记为所在目录（`zh-Hans`），slug 为空
    const { locale, slug } = localeAndSlug(document._meta)
    const key = slug || 'index'
    if (locale !== data.locale)
      throw new Error(`Zodiac locale does not match directory: ${document._meta.path}`)
    const hub = key === 'index'
    if (hub ? data.branch !== undefined : data.branch !== key)
      throw new Error(`Zodiac branch does not match file name: ${document._meta.path}`)
    if (!hub && (!data.years_note || !data.relations_note))
      throw new Error(`Zodiac page needs years_note and relations_note: ${document._meta.path}`)
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Zodiac body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, key, sections }
  },
})

/**
 * ko 토정비결工具页（openspec content-growth-v2-tools 决策 8，第 15 组）：content/tojeong/ko/index.mdx 是工具页的
 * TDK、H1、导语、FAQ 与说明长文。144 段괘 解读在 content/tojeong/ko/gwae/<상괘>.json，页面按需加载，不进本集合
 * （scripts/check-content-tojeong.mjs 校验괘 번호齐全与每段长度）。
 * 构建期拦下合规禁用词；正文（不含空格）不少于 2,000 字（决策 16）。
 */
const TOJEONG_BANNED =
  /띠별\s*운세|잠재의식\s*탐색|신년\s*운세|오락|재미로|재미\s*삼아|길일|대길|대흉|결혼하면 안|결혼해야|이혼수|인공지능|\bAI\b/iu
const tojeong = defineCollection({
  name: 'tojeong',
  directory: 'content/tojeong',
  include: '*/index.mdx',
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1).max(160),
    heading: z.string().min(1),
    lede: z.string().min(1),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(6),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale } = localeAndSlug(document._meta)
    if (locale !== 'ko') throw new Error(`Tojeong locale must be ko: ${document._meta.path}`)
    const text = [
      data.title,
      data.description,
      data.heading,
      data.lede,
      content,
      ...data.faq.flatMap(({ q, a }) => [q, a]),
    ].join('\n')
    const banned = TOJEONG_BANNED.exec(text)
    if (banned) throw new Error(`Tojeong copy contains「${banned[0]}」: ${document._meta.path}`)
    const html = await renderMdx(context, document)
    if (plainText(html).replace(/\s/g, '').length < 2000)
      throw new Error(`Tojeong body must contain at least 2000 characters: ${document._meta.path}`)
    return { ...data, locale, html }
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

/**
 * 西方站月相集合（openspec content-growth-v2-tools 决策 11，第 19 组）：
 * content/moon/<locale>/<key>.mdx 为逐页文案（today、full-moon、full-moon-calendar、moon-calendar 与 12 个月份），
 * `{year}` 占位由页面换成所显示的年份。正文按 `## ` 切段，页面在指定段之间插入月相组件。
 * 文案不写具体日期与时刻（由 moonData 计算）；构建期拦下健康、生育、情绪与「AI」「娱乐」类措辞（决策 11「合规」）。
 */
const MOON_MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const
const MOON_MAIN_KEYS = ['today', 'full-moon', 'full-moon-calendar', 'moon-calendar'] as const
const MOON_BANNED =
  /\bAI\b|entertainment|for fun|fertil|pregnan|menstru|surger|\bhealth|\bmood|\bluck|manifest|horoscope/i

const moon = defineCollection({
  name: 'moon',
  directory: 'content/moon',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1),
    lede: z.string().min(1),
    month: z.number().int().min(1).max(12).optional(),
    moon_name: z.string().min(1).optional(),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug: key } = localeAndSlug(document._meta)
    const month = MOON_MONTH_KEYS.indexOf(key as (typeof MOON_MONTH_KEYS)[number]) + 1
    if (month === 0 && !MOON_MAIN_KEYS.includes(key as (typeof MOON_MAIN_KEYS)[number]))
      throw new Error(`Unknown moon page: ${document._meta.path}`)
    if ((month || undefined) !== data.month || Boolean(month) !== Boolean(data.moon_name))
      throw new Error(
        `Moon month pages need a matching month and moon_name: ${document._meta.path}`,
      )
    const text = [data.title, data.description, data.lede, content]
      .concat(data.faq.flatMap(({ q, a }) => [q, a]))
      .join('\n')
    const banned = MOON_BANNED.exec(text)
    if (banned) throw new Error(`Moon copy contains "${banned[0]}": ${document._meta.path}`)
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Moon body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, locale, key, sections }
  },
})

/**
 * 月相的构建期预计算表（决策 11）：构建日前 1 个月至后 14 个月的逐日表，加上构建年与次年整年的主要月相（年度满月表）。
 * content/moon-data/table.yaml 只是触发文件；数据由 @xuanxue/astro/moon 在构建时生成，客户端不加载 astronomy-engine。
 * 剩余覆盖期不足 13 个月时构建失败（scripts/check-content-moon.mjs 另按当天日期复核已生成的表）。
 */
const moonData = defineCollection({
  name: 'moonData',
  directory: 'content/moon-data',
  include: 'table.yaml',
  parser: 'yaml',
  schema: z.object({ id: z.literal('moon-table') }),
  transform: async (document) => {
    const { assertMoonCoverage, generateMoonBuildData, moonQuarterEvents } = await import(
      '@xuanxue/astro/moon'
    )
    const buildDate = new Date().toISOString().slice(0, 10)
    const table = generateMoonBuildData(buildDate)
    assertMoonCoverage(table.endDate, buildDate)
    const year = Number(buildDate.slice(0, 4))
    // 年度表与逐日表的事件合并为一份：起点取两者较早者，终点取较晚者
    const from = [table.startDate, `${year}-01-01`].sort()[0] ?? table.startDate
    const to = [table.endDate, `${year + 2}-01-01`].sort().at(-1) ?? table.endDate
    return {
      id: document.id,
      buildDate,
      startDate: table.startDate,
      endDate: table.endDate,
      days: table.days,
      events: moonQuarterEvents(from, to),
      years: [year, year + 1],
    }
  },
})

/**
 * 西方星座集合（openspec content-growth-v2-tools 决策 12，第 20 组）：content/western-zodiac/en/ 下
 * `index.mdx` 为星座枢纽，`compatibility.mdx` 为 12×12 配对总表，`<星座>.mdx` 为档案页，
 * `<a>-and-<b>.mdx`（黄道序）为配对页。元素、模式、守护星与角距由页面从事实表计算，这里只保存逐页撰写的文字；
 * 正文按 `## ` 切段分别编译，页面在段间插入事实组件。小标题、篇幅与事实复算见 scripts/check-content-western-zodiac.mjs。
 */
const WESTERN_SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const
function westernZodiacKind(key: string): 'hub' | 'chart' | 'sign' | 'pair' | null {
  if (key === 'index') return 'hub'
  if (key === 'compatibility') return 'chart'
  if ((WESTERN_SIGNS as readonly string[]).includes(key)) return 'sign'
  const [a = '', b = '', ...rest] = key.split('-and-')
  const order: readonly string[] = WESTERN_SIGNS
  const i = order.indexOf(a)
  const j = order.indexOf(b)
  return rest.length === 0 && i >= 0 && j >= i ? 'pair' : null
}
const westernZodiac = defineCollection({
  name: 'westernZodiac',
  directory: 'content/western-zodiac',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    lede: z.string().min(1),
    // 档案页 12 行配对一览的导语
    compat_note: z.string().min(1).optional(),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug } = localeAndSlug(document._meta)
    const key = slug || 'index'
    const kind = westernZodiacKind(key)
    if (locale !== 'en' || !kind)
      throw new Error(`Western zodiac file is not a known page: ${document._meta.path}`)
    if ((kind === 'sign') !== Boolean(data.compat_note))
      throw new Error(
        `compat_note is only and always required on sign pages: ${document._meta.path}`,
      )
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Western zodiac body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, locale, key, kind, sections }
  },
})

/**
 * 西方站主题牌阵集合（openspec content-growth-v2-tools 第 28 组）：content/tarot-spreads/en/<牌阵>.mdx 为
 * 爱情（5 张）、事业（4 张）、满月（4 张）牌阵页的逐页文案。`positions` 为牌位名与说明，按抽牌顺序，
 * 数量须与 @xuanxue/tarot 的 TOPIC_SPREAD_SIZES 一致（scripts/check-content-tarot-spreads.mjs 另核对牌义引用）。
 * 正文按 `## ` 切段。Title、H1 不以 free tarot reading 开头（不争三张牌入口页的主词）；构建期拦下 AI、娱乐类措辞。
 */
const TAROT_SPREAD_SIZES: Readonly<Record<string, number>> = { love: 5, career: 4, 'full-moon': 4 }
const TAROT_SPREAD_BANNED =
  /\bAI\b|artificial intelligence|entertainment|for fun|horoscope|\blucky?\b|soulmate|\bdoomed\b|\bdestined\b/i
const tarotSpreads = defineCollection({
  name: 'tarotSpreads',
  directory: 'content/tarot-spreads',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    lede: z.string().min(1),
    positions: z
      .array(z.object({ name: z.string().min(1), meaning: z.string().min(1) }))
      .min(4)
      .max(5),
    templates: z.array(z.string().min(1).max(80)).length(3),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug: key } = localeAndSlug(document._meta)
    if (locale !== 'en' || TAROT_SPREAD_SIZES[key] === undefined)
      throw new Error(`Tarot spread file is not a known page: ${document._meta.path}`)
    if (data.positions.length !== TAROT_SPREAD_SIZES[key])
      throw new Error(`Tarot spread positions do not match the card count: ${document._meta.path}`)
    if ([data.title, data.heading].some((text) => /^\s*free tarot reading/i.test(text)))
      throw new Error(
        `Title and H1 must not start with "free tarot reading": ${document._meta.path}`,
      )
    const text = [data.title, data.heading, data.description, data.lede, content]
      .concat(data.positions.flatMap(({ name, meaning }) => [name, meaning]))
      .concat(data.templates)
      .concat(data.faq.flatMap(({ q, a }) => [q, a]))
      .join('\n')
    const banned = TAROT_SPREAD_BANNED.exec(text)
    if (banned) throw new Error(`Tarot spread copy contains "${banned[0]}": ${document._meta.path}`)
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Tarot spread body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, locale, key, sections }
  },
})

/**
 * 东方站年度生肖集合（openspec content-growth-v2-tools 决策 6；第 8 组建 schema，第 9、10、11 组只加内容文件）：
 * content/yearly/<locale>/<年份>/<地支 key>.mdx 为年度生肖页，index.mdx 为年度枢纽。
 * 关系表、出生年份与纳音、立春与春节由页面按引擎计算，这里只保存逐页撰写的文字：
 * `relations_note`（关系表导语）、`focus`（工作、关系、自我照顾三个主题段，反思与建议语气）、
 * `years_note`（出生年份表导语）。正文按 `## ` 切段：子页依次为「与流年的关系」「用完整八字看」两段，
 * 页面在第一段的正文前插入关系表，在两段之间插入主题段与出生年份表（features/east-content/yearly/）。
 */
const YEARLY_FOCUS = ['work', 'relationships', 'self'] as const
const yearly = defineCollection({
  name: 'yearly',
  directory: 'content/yearly',
  include: '*/*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    slug: z
      .string()
      .min(1)
      .regex(/^[^/\s]+$/),
    locale: z.enum(['zh-Hans', 'zh-Hant', 'ko', 'en']),
    year: z.number().int().min(1924).max(2043),
    // 枢纽页没有地支
    branch: z.enum(ZODIAC_BRANCHES).optional(),
    lede: z.string().min(1),
    relations_note: z.string().min(1).optional(),
    focus: z
      .array(z.object({ theme: z.enum(YEARLY_FOCUS), text: z.string().min(1) }))
      .length(3)
      .optional(),
    years_note: z.string().min(1).optional(),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    // content-collections 把 index.mdx 的路径记为所在目录（`zh-Hans/2027`）
    const [locale = '', year = '', file = 'index'] = document._meta.path.split('/')
    const key = file || 'index'
    if (locale !== data.locale)
      throw new Error(`Yearly locale does not match directory: ${document._meta.path}`)
    if (year !== String(data.year))
      throw new Error(`Yearly year does not match directory: ${document._meta.path}`)
    const hub = key === 'index'
    if (hub ? data.branch !== undefined : data.branch !== key)
      throw new Error(`Yearly branch does not match file name: ${document._meta.path}`)
    if (!hub) {
      if (!data.relations_note || !data.years_note || !data.focus)
        throw new Error(
          `Yearly page needs relations_note, focus and years_note: ${document._meta.path}`,
        )
      // 三个主题按固定顺序（工作、关系、自我照顾），页面按此顺序渲染小标题
      if (data.focus.map((item) => item.theme).join() !== YEARLY_FOCUS.join())
        throw new Error(`Yearly focus must be ${YEARLY_FOCUS.join(', ')}: ${document._meta.path}`)
    }
    const chunks = content.split(/^## /m).slice(1)
    if (hub ? chunks.length < 2 : chunks.length !== 2)
      throw new Error(
        `Yearly body needs ${hub ? 'at least 2' : 'exactly 2'} "## " sections: ${document._meta.path}`,
      )
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    // 主题段允许用空行分段
    const focus = (data.focus ?? []).map((item) => ({
      theme: item.theme,
      paragraphs: item.text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    }))
    return { ...data, key, sections, focus }
  },
})

/**
 * 合盘工具正文与关系场景页（openspec content-growth-v2-tools 决策 2、7、14，第 13 组）：
 * content/compat/<locale>/index.mdx 是工具页（zh-Hans、zh-Hant、ja、en；ko `/사주궁합` 正文不改，没有 index），
 * <场景>.mdx 是 5 个场景页。`items` 是每个 CompatItemKey 在该场景下的一段解释，页面在结果与正文中渲染。
 * 构建期拦下关系判定词（与 scripts/audit-verdict.mjs 同一词表口径）与合规禁用词，并按决策 16 检查渲染正文长度
 * （导语与长文，不含 FAQ 与分项解释；中文按汉字，ko、ja 按不含空白的字符，en 按词）。
 */
const COMPAT_PAGES = ['index', 'marriage', 'couple', 'friends', 'business', 'parent-child'] as const
const COMPAT_ITEM_KEYS = [
  'stemCombine',
  'branchSixCombine',
  'branchTriad',
  'branchClash',
  'branchPunish',
  'elementComplementAB',
  'elementComplementBA',
] as const
const COMPAT_BANNED =
  /宜结婚|宜結婚|不能结婚|不能結婚|会离婚|會離婚|必离|必離|克夫|剋夫|克妻|剋妻|注定分手|註定分手|必然分手|最佳婚配|不能在一起|不能嫁|自我探索|娱乐|娛樂|결혼하면 안|결혼해야|이혼수|이혼하게 됩|상극이라 헤어|헤어질 운명|최고의 혼인 상대|남편을 해치는|아내를 해치는|띠별\s*운세|신년\s*운세|오락|재미로|재미\s*삼아|잠재의식\s*탐색|結婚してはいけない|結婚すべき|離婚する|離婚します|必ず別れる|別れる運命|最良の結婚相手|夫を不幸にする|妻を不幸にする|娯楽|エンタメ|\bshould(?: not)? marry\b|\bmust not marry\b|\bcannot marry\b|\bwill (?:get )?divorced?\b|\bdoomed\b|\bdestined to break up\b|\bbest marriage match\b|\bentertainment\b|\bfor fun\b|人工智能|인공지능|\bAI\b/iu
/** 渲染正文长度下限（决策 16）：[工具页, 场景页] */
const COMPAT_MIN_LENGTH: Record<string, readonly [number, number]> = {
  'zh-Hans': [1200, 800],
  'zh-Hant': [1200, 800],
  ko: [0, 1000],
  ja: [1500, 1000],
  en: [900, 600],
}
function compatLength(locale: string, text: string): number {
  if (locale === 'zh-Hans' || locale === 'zh-Hant')
    return text.match(/\p{Script=Han}/gu)?.length ?? 0
  if (locale === 'en') return text.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word)).length
  return text.replace(/\s/g, '').length
}
const compat = defineCollection({
  name: 'compat',
  directory: 'content/compat',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1).max(170),
    /** 场景页的 H1 与导语；工具页沿用 messages/<locale>/compat.json 的 H1 与简介 */
    heading: z.string().min(1).optional(),
    lede: z.string().min(1).optional(),
    /** 面包屑末项、同组卡片标题、其他页指向本页的锚文本（场景页与 compat/paths.ts 的导航名一致） */
    short: z.string().min(1),
    /** 同组卡片的一行说明（场景页） */
    note: z.string().min(1).optional(),
    /** 本页正文链向工具页的锚文本（场景页；每种语言两种表述之一） */
    tool_anchor: z.string().min(1).optional(),
    items: z
      .object(Object.fromEntries(COMPAT_ITEM_KEYS.map((key) => [key, z.string().min(1)])))
      .strict(),
    /** origin：本语言原写（local）或改写自其他语言（adapted），多语言相似度的 FAQ 来源统计用 */
    faq: z
      .array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
          origin: z.enum(['local', 'adapted']),
        }),
      )
      .min(2)
      .max(5),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug } = localeAndSlug(document._meta)
    const path = document._meta.path
    const page = (slug || 'index') as (typeof COMPAT_PAGES)[number]
    if (!(locale in COMPAT_MIN_LENGTH)) throw new Error(`Compat locale not supported: ${path}`)
    if (!COMPAT_PAGES.includes(page)) throw new Error(`Unknown compat page: ${path}`)
    if (page === 'index' && locale === 'ko')
      throw new Error(`ko tool page body must not change (no index): ${path}`)
    if (page !== 'index' && !(data.heading && data.lede && data.note && data.tool_anchor))
      throw new Error(`Compat scenario page needs heading, lede, note and tool_anchor: ${path}`)
    const items = data.items as Record<(typeof COMPAT_ITEM_KEYS)[number], string>
    const html = await renderMdx(context, document)
    if (/<a\s/i.test(html)) throw new Error(`Compat body links are generated, not written: ${path}`)
    const text = [
      data.title,
      data.description,
      data.heading,
      data.lede,
      data.short,
      data.note,
      content,
      ...Object.values(items),
      ...data.faq.flatMap(({ q, a }) => [q, a]),
    ].join('\n')
    const banned = COMPAT_BANNED.exec(text)
    if (banned) throw new Error(`Compat copy contains「${banned[0]}」: ${path}`)
    // 场景页的分项解释只在结果中出现（不在预渲染正文里），长度按导语与长文计
    const body = [data.lede ?? '', plainText(html)].join('\n')
    const min = COMPAT_MIN_LENGTH[locale]?.[page === 'index' ? 0 : 1] ?? 0
    const length = compatLength(locale, body)
    if (length < min) throw new Error(`Compat body is ${length}, below the minimum ${min}: ${path}`)
    return { ...data, items, locale, page, html }
  },
})

/**
 * 生肖配对集合（openspec content-growth-v2-tools 决策 9，第 16 组建；第 17 组只加 ko、en 内容）：
 * content/zodiac-pair/<locale>/<地支 key>-<地支 key>.mdx 为配对页（按地支顺序，如 `zi-chou.mdx`），
 * index.mdx 为 12×12 总表页。地支关系、五行生克与年份表由页面按引擎计算（zodiacPairFacts），
 * 这里只保存逐组撰写的文字：`relations_note`（关系表导语）与按 `## ` 切开的正文段。
 */
const zodiacPair = defineCollection({
  name: 'zodiacPair',
  directory: 'content/zodiac-pair',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    slug: z
      .string()
      .min(1)
      .regex(/^[^/\s]+$/),
    locale: z.enum(['zh-Hans', 'ko', 'en']),
    // 总表页没有配对 key
    pair: z
      .string()
      .regex(new RegExp(`^(?:${ZODIAC_BRANCHES.join('|')})-(?:${ZODIAC_BRANCHES.join('|')})$`))
      .optional(),
    lede: z.string().min(1),
    relations_note: z.string().min(1).optional(),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    // content-collections 把 index.mdx 的路径记为所在目录，slug 为空
    const { locale, slug } = localeAndSlug(document._meta)
    const key = slug || 'index'
    if (locale !== data.locale)
      throw new Error(`Zodiac pair locale does not match directory: ${document._meta.path}`)
    const hub = key === 'index'
    if (hub ? data.pair !== undefined : data.pair !== key)
      throw new Error(`Zodiac pair key does not match file name: ${document._meta.path}`)
    if (!hub) {
      const [a = '', b = ''] = key.split('-')
      const order = ZODIAC_BRANCHES as readonly string[]
      if (order.indexOf(a) > order.indexOf(b))
        throw new Error(`Zodiac pair must follow branch order: ${document._meta.path}`)
      if (!data.relations_note)
        throw new Error(`Zodiac pair page needs relations_note: ${document._meta.path}`)
    }
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Zodiac pair body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, key, sections }
  },
})

/**
 * 西方站 angel numbers 集合（openspec content-growth-v2-tools 第 26 组，specs/angel-number-pages）：
 * content/angel-numbers/<locale>/<数字>.mdx 为数字页，index.mdx 为枢纽；en、es 各自选数字、各自撰写。
 * 文件存在即已发布：枢纽只列本语言的数字页，hreflang 只连两种语言都有的同一数字
 * （features/west-content/angel-numbers/seo-pages.ts）。各位数字、排列、各位之和与根数由页面按
 * @xuanxue/numerology 的约简规则计算，这里只保存逐页撰写的文字：`theme`（枢纽格子副标签）、
 * `question`（文末反思问题）与按 `## ` 切段的正文。
 */
const angelNumbers = defineCollection({
  name: 'angelNumbers',
  directory: 'content/angel-numbers',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    lede: z.string().min(1),
    // 数字页必填：枢纽与相邻数字格子的副标签、文末问题
    theme: z.string().min(1).optional(),
    question: z.string().min(1).optional(),
    faq: z
      .array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
          origin: z.enum(['local', 'adapted']).optional(),
        }),
      )
      .min(2)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug } = localeAndSlug(document._meta)
    const key = slug || 'index'
    if (!['en', 'es'].includes(locale) || !(key === 'index' || /^\d{3,4}$/.test(key)))
      throw new Error(`Angel number file is not a known page: ${document._meta.path}`)
    if (key !== 'index' && !(data.theme && data.question))
      throw new Error(`Angel number pages need theme and question: ${document._meta.path}`)
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Angel number body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, locale, key, sections }
  },
})

/**
 * 西方站 personal year 集合（openspec content-growth-v2-tools 决策 2、16，第 27 组）：content/personal-year/<locale>/ 下
 * `index.mdx` 为计算器页正文，`1.mdx` … `9.mdx` 为年份数页（en、es 各自撰写）。数字面板、示例算式与九年周期由页面
 * 按 `@xuanxue/numerology` 计算，这里只保存逐页文字：年份数页另有 3 个自问问题（`questions`）。
 * 正文按 `## ` 切段分别编译；构建期拦下 AI、预测与运气类措辞。篇幅与算式复核见 scripts/check-content-personal-year.mjs。
 */
const PERSONAL_YEAR_BANNED =
  /\bAI\b|entertainment|for fun|\bluck|\blucky\b|\bfate\b|\bdestiny\b|manifest|guarantee|entretenimiento|\bsuerte\b|\bdestino\b|garantiz/i
const personalYear = defineCollection({
  name: 'personalYear',
  directory: 'content/personal-year',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    lede: z.string().min(1),
    questions: z.array(z.string().min(1)).length(3).optional(),
    // origin：本语言原创（local）或改写自他语言（adapted），供本地化测量统计
    faq: z
      .array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
          origin: z.enum(['local', 'adapted']).optional(),
        }),
      )
      .min(2)
      .max(4),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug } = localeAndSlug(document._meta)
    const key = slug || 'index'
    const number = /^[1-9]$/.test(key) ? Number(key) : null
    if (!['en', 'es'].includes(locale) || (key !== 'index' && number === null))
      throw new Error(`Personal year file is not a known page: ${document._meta.path}`)
    if ((number !== null) !== Boolean(data.questions))
      throw new Error(
        `questions are only and always required on number pages: ${document._meta.path}`,
      )
    const text = [data.title, data.heading, data.description, data.lede, content]
      .concat(
        data.questions ?? [],
        data.faq.flatMap(({ q, a }) => [q, a]),
      )
      .join('\n')
    const banned = PERSONAL_YEAR_BANNED.exec(text)
    if (banned)
      throw new Error(`Personal year copy contains "${banned[0]}": ${document._meta.path}`)
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Personal year body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, locale, key, number, sections }
  },
})

/**
 * 西方站三巨头计算器与出生星盘（openspec content-growth-v2-tools 决策 19，第 23 组）：
 * content/natal-chart/en/rising-sign-calculator.mdx 与 birth-chart.mdx 为两页工具下方的正文与 FAQ。
 * 行星位置、宫位与相位都在浏览器按 @xuanxue/astro/chart 计算，这里只保存逐页撰写的文字；正文按 `## ` 切段。
 * 构建期拦下「AI」「娱乐」与预测类措辞（公开正文不提 AI，决策 16 第 8 项）。
 */
const NATAL_KEYS = ['rising-sign-calculator', 'birth-chart'] as const
const NATAL_BANNED =
  /\bAI\b|artificial intelligence|entertainment|for fun|guarantee|\bwill happen\b|self-exploration|chinese zodiac/i
const natalChart = defineCollection({
  name: 'natalChart',
  directory: 'content/natal-chart',
  include: '*/*.mdx',
  schema: z.object({
    title: z.string().min(1).max(47),
    heading: z.string().min(1),
    description: z.string().min(1).max(160),
    lede: z.string().min(1),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(5),
    updated: isoDate,
    content: z.string(),
  }),
  transform: async (document, context) => {
    const { content, ...data } = document
    const { locale, slug: key } = localeAndSlug(document._meta)
    if (locale !== 'en' || !NATAL_KEYS.includes(key as (typeof NATAL_KEYS)[number]))
      throw new Error(`Natal chart file is not a known page: ${document._meta.path}`)
    const text = [data.title, data.description, data.lede, content]
      .concat(data.faq.flatMap(({ q, a }) => [q, a]))
      .join('\n')
    const banned = NATAL_BANNED.exec(text)
    if (banned) throw new Error(`Natal chart copy contains "${banned[0]}": ${document._meta.path}`)
    const chunks = content.split(/^## /m).slice(1)
    if (chunks.length === 0)
      throw new Error(`Natal chart body needs "## " sections: ${document._meta.path}`)
    const sections = await Promise.all(
      chunks.map(async (chunk) => {
        const newline = chunk.indexOf('\n')
        const title = chunk.slice(0, newline).trim()
        const body = chunk.slice(newline + 1)
        return { title, html: await renderMdx(context, { ...document, content: body }) }
      }),
    )
    return { ...data, locale, key, sections }
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
    taiSuiYear,
    guides,
    zodiac,
    tojeong,
    moon,
    moonData,
    westernZodiac,
    tarotSpreads,
    yearly,
    compat,
    zodiacPair,
    angelNumbers,
    personalYear,
    natalChart,
  ],
})
