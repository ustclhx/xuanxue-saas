import { Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, isLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { useSiteId } from '../site/context.tsx'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { useLocaleSwitch } from './locale-switch.ts'
import { releasedSiteLocales } from './rollout.ts'

// 与 language-controls.tsx 分开：这里用到 Select（Radix 弹层），只有后台与侧边栏布局加载，不进公开页面的包

/**
 * 后台侧栏使用的语言下拉（自带位置，不做浮层）。应用区地址不带语言前缀，语言取自账号设置，
 * 这里保存账号语言后刷新；公开页面的语言控件见上方的链接菜单。
 */
export function LanguageSelect() {
  const locale = getLocale()
  // 与页头菜单相同只列本站已发布语言；另一站语言在本站应用区不生效（request.server.ts accountLocale）
  const siteLocales = releasedSiteLocales(useSiteId(), templateConfig)
  const { busy, error, select } = useLocaleSwitch()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (siteLocales.length < 2) return null
  const currentLabel = LOCALE_AUTONYMS[locale] ?? locale
  return (
    <>
      <div className="inline-flex min-h-11 w-fit items-center">
        <span className="sr-only">{m.i18n_language()}</span>
        <Select
          value={siteLocales.some((value) => value === locale) ? locale : ''}
          disabled={!ready || busy}
          onValueChange={(value) => {
            if (isLocale(value)) void select(value)
          }}
        >
          <SelectTrigger
            aria-label={m.i18n_language()}
            className="min-h-11 w-full min-w-0"
            placeholder={m.i18n_language()}
            valueLabel={currentLabel}
          />
          <SelectContent>
            {siteLocales.map((value, index) => (
              <SelectItem key={value} index={index} value={value}>
                {LOCALE_AUTONYMS[value] ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </>
  )
}

/**
 * 模板工作台侧边栏布局（ui.appLayout='sidebar'）使用的语言切换入口；本项目目前用 topbar 布局，
 * 这里复用后台侧栏的下拉，保证切换到侧边栏布局时语言列表同样只列本站语言。
 */
export function LanguageControls(
  _props: { placement?: 'floating' | 'inline' | 'bare'; suggest?: boolean } = {},
) {
  return <LanguageSelect />
}
