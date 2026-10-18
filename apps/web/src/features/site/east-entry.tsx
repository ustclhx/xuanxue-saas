import { Card, CardContent, CardHeader, CardTitle } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { MarketingShell } from '../marketing/marketing-shell.tsx'
import { LOCALE_AUTONYMS } from './theme.ts'

/** 服务器稳定输出双语入口，浏览器语言只用于高亮，绝不自动导航。 */
export function EastEntry() {
  const [preferred, setPreferred] = useState<string>()
  useEffect(() => {
    for (const language of navigator.languages) {
      const locale = templateConfig.sites.east.locales.find(
        (l) => language.toLowerCase().split('-')[0] === l.toLowerCase().split('-')[0],
      )
      if (locale) {
        setPreferred(locale)
        break
      }
    }
  }, [])
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-heading text-3xl">
          <span lang="zh-Hant">{m.site_entry_title({}, { locale: 'zh-Hant' })}</span> ·{' '}
          <span lang="ko">{m.site_entry_title({}, { locale: 'ko' })}</span>
        </h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {templateConfig.sites.east.locales.map((locale) => (
            <a
              key={locale}
              href={`${localePrefix(locale)}/`}
              hrefLang={locale}
              lang={locale}
              data-testid={`entry-${locale}`}
              data-recommended={preferred === locale}
              className={`block rounded-xl focus-visible:outline-2 focus-visible:outline-brand ${preferred === locale ? 'ring-2 ring-brand' : ''}`}
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{LOCALE_AUTONYMS[locale]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{m.site_entry_description({}, { locale })}</p>
                  {preferred === locale && (
                    <p className="mt-3 text-sm text-brand-ink">
                      {m.site_entry_recommended({}, { locale })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </section>
    </MarketingShell>
  )
}
