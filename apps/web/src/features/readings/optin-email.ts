import { localeUrlSegment, type TemplateConfig } from '@xuanxue/config'
import type { EmailTemplateProps } from '@xuanxue/email/queue'
import { AppError } from '@xuanxue/shared'
import { CARDS } from '@xuanxue/tarot'
import en from '../../../messages/en/readings-email.json'
import ko from '../../../messages/ko/readings-email.json'
import zhHant from '../../../messages/zh-Hant/readings-email.json'
import { TOOL_ROUTES } from '../tools/registry.ts'
import { shareUrl } from '../tools/share.ts'
import type { ReadingOptin } from './optin-schema.ts'

const copies: Record<ReadingOptin['locale'], Record<string, string>> = { en, ko, 'zh-Hant': zhHant }

/** L1 的输入只用于选择固定段落，不进入 AI，也不能指定邮件正文或外部链接。 */
export function optinToolPath(input: ReadingOptin, config: TemplateConfig): string {
  const { sourceTool, site, locale, result } = input
  const id = sourceTool === 'manseryeok' ? 'bazi' : sourceTool
  const route = TOOL_ROUTES.find((entry) => entry.id === id && entry.site === site)
  const path = route?.paths[locale]
  const kindMatches =
    result.kind === 'bazi'
      ? ['bazi', 'manseryeok', 'mingpan'].includes(sourceTool)
      : result.kind === 'numerology'
        ? ['life-path', 'numerology-calculator'].includes(sourceTool)
        : sourceTool.startsWith('tarot-') &&
          result.cards.every((card) => CARDS.some((entry) => entry.id === card.cardId))
  if (!path || !kindMatches || !config.sites[site].locales.includes(locale))
    throw new AppError('INVALID_INPUT', 'Invalid reading source', { status: 400 })
  const prefix = config.sites[site].defaultLocale === locale ? '' : `/${localeUrlSegment(locale)}`
  return path === '/' ? prefix || '/' : `${prefix}${encodeURI(path)}`
}

export function optinEmailProps(
  input: ReadingOptin,
  config: TemplateConfig,
  unsubscribeUrl: string,
): EmailTemplateProps['reading-summary'] {
  const path = optinToolPath(input, config)
  const copy = copies[input.locale]
  const text = (key: string) => {
    const value = copy[`reading_email_${key}`]
    if (!value) throw new Error(`Reading email template missing: ${key}`)
    return value
  }
  const result = input.result
  const paragraphs =
    result.kind === 'tarot'
      ? result.cards.flatMap((card) => [
          text(`tarot_${card.cardId.replaceAll('-', '_')}_${input.topic}`),
          text(
            `tarot_${card.cardId.replaceAll('-', '_')}_${card.reversed ? 'reversed' : 'upright'}`,
          ),
        ])
      : [
          text(
            result.kind === 'bazi' ? `bazi_${result.dayMaster}` : `numerology_${result.lifePath}`,
          ),
          text(`topic_${input.topic}`),
        ]
  const origin = `https://${config.sites[input.site].hosts[0]}`
  const resultUrl = shareUrl(new URL(path, origin).href, input.share)
  return {
    name: input.name,
    subject: text('subject'),
    paragraphs,
    resultUrl,
    unlockUrl: resultUrl,
    unsubscribeUrl,
    disclaimer: text('disclaimer'),
  }
}
