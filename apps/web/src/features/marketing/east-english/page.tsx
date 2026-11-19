import { TOOL_ROUTES } from '../../tools/registry.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { ContentHead, ContentPage, type InlineLink, inlineLinks } from '../content-page.tsx'
import {
  EAST_ENGLISH_COPY as copy,
  type EastLocale,
  type EnglishSection,
  type EnglishToolLink,
} from './content.ts'

/** 东方站工具在某语言下的地址与原文名称；注册表缺失时不渲染该链接 */
export function eastToolLink(tool: string, locale: EastLocale) {
  const route = TOOL_ROUTES.find((item) => item.id === tool && item.site === 'east')
  const path = route?.paths[locale]
  const title = route?.titles[locale]
  return path && title ? { href: toolHref(path, locale), title } : null
}

/** 入口句里各 key 的链接：工具页取注册表地址，未指定工具时为该语言的首页；带 hreflang 与 lang */
function sectionLinks(links: Readonly<Record<string, EnglishToolLink>>) {
  const result: Record<string, InlineLink | undefined> = {}
  for (const [key, { tool, locale }] of Object.entries(links)) {
    const href = tool ? eastToolLink(tool, locale)?.href : toolHref('/', locale)
    result[key] = href ? { href, hrefLang: locale, lang: locale } : undefined
  }
  return result
}

const firstHeading = 'm-0 text-balance font-heading text-ink text-title'
const heading = `${firstHeading} mt-5`
const paragraph = 'm-0 text-body text-ink-muted'

/**
 * 东方站 `/en` 英文入口页（openspec product-improve-ai-content-20261030 tasks.md 4.8，D5；
 * 设计稿 docs/design/prototypes/warm-refresh/EastEn.dc.html）：单栏长文，限宽 720px。
 * 每个体系一个 H2，段落之后一句入口，全页正文共 5 条链接（八字排盤、简体中文、紫微斗數排盤、만세력、三張牌塔羅）；
 * 只链接本站繁中、简体与韩语页面，不链接西方站。语言切换在页头与页脚。
 */
export function EastEnglishPage() {
  const sections: readonly EnglishSection[] = copy.sections
  return (
    <ContentPage>
      <ContentHead
        eyebrow={<p className="m-0 text-caption text-ink-subtle">{copy.eyebrow}</p>}
        title={copy.heading}
      >
        {copy.lead.map((text) => (
          <p key={text} className={paragraph}>
            {text}
          </p>
        ))}
      </ContentHead>

      <article className="flex max-w-180 flex-col gap-5">
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className="flex scroll-mt-6 flex-col gap-5"
          >
            <h2 id={`${section.id}-title`} className={index === 0 ? firstHeading : heading}>
              {section.title}
            </h2>
            <p lang={section.nativeLang} className="m-0 text-caption text-ink-subtle">
              {section.native}
            </p>
            {section.paragraphs.map((text) => (
              <p key={text} className={paragraph}>
                {text}
              </p>
            ))}
            <p className={paragraph}>{inlineLinks(section.open, sectionLinks(section.links))}</p>
          </section>
        ))}

        <h2 className={heading}>{copy.nameTitle}</h2>
        {copy.name.map((text) => (
          <p key={text} className={paragraph}>
            {text}
          </p>
        ))}

        <h2 className={heading}>{copy.usingTitle}</h2>
        {copy.using.map((text) => (
          <p key={text} className={paragraph}>
            {text}
          </p>
        ))}

        <h2 className={heading}>{copy.methodTitle}</h2>
        {copy.method.map((text, index) =>
          index === copy.method.length - 1 ? (
            // 合规声明：caption 小字，不加底色（refresh-visual-system-warm D9）
            <p key={text} role="note" className="m-0 text-caption text-ink-subtle">
              {text}
            </p>
          ) : (
            <p key={text} className={paragraph}>
              {text}
            </p>
          ),
        )}
      </article>
    </ContentPage>
  )
}
