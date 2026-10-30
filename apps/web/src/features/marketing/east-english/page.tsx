import { TOOL_ROUTES } from '../../tools/registry.ts'
import { circledNumber } from '../../tools/result-block.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { EAST_ENGLISH_COPY as copy, type EastLocale } from './content.ts'

/** 东方站工具在某语言下的地址与原文名称；注册表缺失时不渲染该链接 */
export function eastToolLink(tool: string, locale: EastLocale) {
  const route = TOOL_ROUTES.find((item) => item.id === tool && item.site === 'east')
  const path = route?.paths[locale]
  const title = route?.titles[locale]
  return path && title ? { href: toolHref(path, locale), title } : null
}

const card = 'rounded-xl border border-line bg-surface'
const sectionTitle = 'm-0 font-heading font-bold text-[24px] text-ink leading-snug'
const body = 'm-0 text-[16px] text-ink-muted leading-relaxed'

/**
 * 东方站 `/en` 英文入口页（openspec product-improve-ai-content-20261030 tasks.md 4.8，D5）：
 * 东方站主题与字体（根布局按 Host 设置 data-site），区块编号与卡片沿用东方站工具页
 * （docs/design/visual-system.md）；只链接本站繁中、简体与韩语工具，不链接西方站。
 */
export function EastEnglishPage() {
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-14 px-4 pt-10 pb-16 sm:px-6">
      <header className="flex max-w-[760px] flex-col gap-3">
        <p className="m-0 text-ink-subtle text-sm tracking-wide">{copy.eyebrow}</p>
        <h1 className="m-0 font-bold font-heading text-[32px] text-ink leading-tight sm:text-[40px]">
          {copy.heading}
        </h1>
        {copy.lead.map((text) => (
          <p key={text} className="m-0 text-[17px] text-ink-muted leading-relaxed">
            {text}
          </p>
        ))}
      </header>

      <nav aria-labelledby="languages-title" className="flex flex-col gap-4">
        <h2 id="languages-title" className={sectionTitle}>
          {copy.languagesTitle}
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
          {copy.languages.map((language) => (
            <li key={language.locale}>
              <a
                href={toolHref('/', language.locale)}
                hrefLang={language.locale}
                className={`${card} group flex h-full min-h-11 flex-col gap-1.5 p-5 transition-colors hover:border-line-strong`}
              >
                <span
                  lang={language.locale}
                  className="flex items-center justify-between gap-3 font-bold font-heading text-[22px] text-ink"
                >
                  {language.name}
                  <ArrowIcon />
                </span>
                <span className="font-semibold text-brand-ink text-sm">{language.english}</span>
                <span className="text-ink-subtle text-sm leading-relaxed">{language.summary}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section
        aria-labelledby="name-title"
        className="flex flex-col gap-3 rounded-xl bg-surface-2 px-5 py-6 sm:px-8"
      >
        <h2 id="name-title" className={sectionTitle}>
          {copy.nameTitle}
        </h2>
        {copy.name.map((text) => (
          <p key={text} className={`${body} max-w-[760px]`}>
            {text}
          </p>
        ))}
      </section>

      <section aria-labelledby="systems-title" className="flex flex-col gap-5">
        <h2 id="systems-title" className={sectionTitle}>
          {copy.sectionsTitle}
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {copy.sections.map((section, index) => (
            <article
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className={`${card} flex scroll-mt-6 flex-col gap-3.5 p-5 sm:p-6`}
            >
              <header className="flex flex-col gap-1">
                <h3
                  id={`${section.id}-title`}
                  className="m-0 flex items-baseline gap-2 font-bold font-heading text-[20px] text-ink"
                >
                  <span aria-hidden="true" className="text-brand">
                    {circledNumber(index + 1)}
                  </span>
                  <span>{section.title}</span>
                </h3>
                <p
                  lang={'nativeLang' in section ? section.nativeLang : undefined}
                  className="m-0 font-heading text-ink-subtle text-sm"
                >
                  {section.native}
                </p>
              </header>
              {section.paragraphs.map((text) => (
                <p key={text} className={body}>
                  {text}
                </p>
              ))}
              <ul className="m-0 mt-auto grid list-none gap-2 p-0">
                {section.links.map(({ tool, locale, gloss }) => {
                  const link = eastToolLink(tool, locale)
                  if (!link) return null
                  return (
                    <li key={`${tool}-${locale}`}>
                      <a
                        href={link.href}
                        hrefLang={locale}
                        className="group flex min-h-11 items-center justify-between gap-3 rounded-[10px] border border-line bg-background px-3.5 py-2.5 transition-colors hover:border-line-strong"
                      >
                        <span className="flex flex-wrap items-baseline gap-x-2.5">
                          <span lang={locale} className="font-heading font-semibold text-ink">
                            {link.title}
                          </span>
                          <span className="text-ink-subtle text-sm">{gloss}</span>
                        </span>
                        <ArrowIcon />
                      </a>
                    </li>
                  )
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="using-title" className="flex flex-col gap-3">
          <h2 id="using-title" className={sectionTitle}>
            {copy.usingTitle}
          </h2>
          {copy.using.map((text) => (
            <p key={text} className={body}>
              {text}
            </p>
          ))}
        </section>
        <section aria-labelledby="method-title" className="flex flex-col gap-3">
          <h2 id="method-title" className={sectionTitle}>
            {copy.methodTitle}
          </h2>
          {copy.method.map((text, index) =>
            index === copy.method.length - 1 ? (
              // 合规声明：与工具页一致的浅色条（视觉规范「合规声明」）
              <p
                key={text}
                role="note"
                className="m-0 rounded-lg bg-surface-2 px-4 py-3.5 text-ink-muted text-sm leading-relaxed"
              >
                {text}
              </p>
            ) : (
              <p key={text} className={body}>
                {text}
              </p>
            ),
          )}
        </section>
      </div>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
    >
      <path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
