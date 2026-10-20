import { renderEmail } from '@xuanxue/email'
import { CARDS } from '@xuanxue/tarot'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { decodeShareInput } from '../tools/share.ts'
import { optinEmailProps, optinToolPath } from './optin-email.ts'
import { OPTIN_TOPICS, type ReadingOptin } from './optin-schema.ts'

const reading = (locale: ReadingOptin['locale']): ReadingOptin => ({
  name: 'Ada <script>',
  sourceTool: locale === 'en' ? 'life-path' : 'bazi',
  topic: 'career',
  site: locale === 'en' ? 'west' : 'east',
  locale,
  result:
    locale === 'en' ? { kind: 'numerology', lifePath: 11 } : { kind: 'bazi', dayMaster: 'geng' },
  share: locale === 'en' ? { date: '1987-11-29' } : { year: '1990', month: '5', day: '15' },
})
const unsubscribe = 'https://arcanumber.com/api/newsletter/unsubscribe?token=fixture'

describe('个性化邮件', () => {
  it.each(['en', 'zh-Hant', 'ko'] as const)(
    '%s 内容与渲染快照包含结果链接、完整分析、退订与声明',
    async (locale) => {
      const input = reading(locale)
      const props = optinEmailProps(input, templateConfig, unsubscribe)
      const email = await renderEmail('reading-summary', props, { locale, appName: 'Xuanxue' })
      expect({ subject: email.subject, html: email.html, text: email.text }).toMatchSnapshot()
      expect(email.headers?.['List-Unsubscribe']).toBe(`<${unsubscribe}>`)
      expect(email.html).not.toContain('<script>')
      const link = new URL(props.resultUrl)
      expect(link.host).toBe(templateConfig.sites[input.site].hosts[0])
      expect(decodeShareInput(link.hash.slice(3))).toEqual(input.share)
    },
  )

  it('模板覆盖全部日主、生命灵数、78 张牌的正逆位与五种主题，并按牌名与主题选取', () => {
    for (const locale of ['en', 'zh-Hant', 'ko'] as const) {
      for (const topic of OPTIN_TOPICS) {
        for (const dayMaster of [
          'jia',
          'yi',
          'bing',
          'ding',
          'wu',
          'ji',
          'geng',
          'xin',
          'ren',
          'gui',
        ] as const) {
          // 八字路由提供繁中与韩语；英语模板保留供后续语言路由复用。
          if (locale !== 'en')
            expect(
              optinEmailProps(
                { ...reading(locale), topic, result: { kind: 'bazi', dayMaster } },
                templateConfig,
                unsubscribe,
              ).paragraphs,
            ).toHaveLength(2)
        }
        if (locale === 'en')
          for (const lifePath of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]) {
            expect(
              optinEmailProps(
                { ...reading(locale), topic, result: { kind: 'numerology', lifePath } },
                templateConfig,
                unsubscribe,
              ).paragraphs,
            ).toHaveLength(2)
          }
        for (const card of CARDS)
          for (const reversed of [false, true]) {
            const props = optinEmailProps(
              {
                ...reading(locale),
                sourceTool: 'tarot-daily',
                topic,
                result: { kind: 'tarot', cards: [{ cardId: card.id, reversed }] },
              },
              templateConfig,
              unsubscribe,
            )
            expect(props.paragraphs).toHaveLength(2)
            expect(props.paragraphs.join('')).not.toContain('undefined')
          }
      }
    }
    const tarot = {
      ...reading('en'),
      sourceTool: 'tarot-daily',
      result: { kind: 'tarot' as const, cards: [{ cardId: 'major-00', reversed: false }] },
    }
    expect(optinEmailProps(tarot, templateConfig, unsubscribe).paragraphs[0]).toContain('The Fool')
    expect(optinEmailProps(tarot, templateConfig, unsubscribe).paragraphs).not.toEqual(
      optinEmailProps({ ...tarot, topic: 'love' }, templateConfig, unsubscribe).paragraphs,
    )
  })

  it('拒绝工具、结果与站点语言错配，客户端不能指定外部邮件落地页', () => {
    for (const input of [
      { ...reading('en'), sourceTool: 'https://evil.test' },
      { ...reading('en'), site: 'east' as const },
      { ...reading('en'), result: { kind: 'bazi' as const, dayMaster: 'jia' as const } },
      {
        ...reading('en'),
        sourceTool: 'tarot-daily',
        result: { kind: 'tarot' as const, cards: [{ cardId: 'major-99', reversed: false }] },
      },
    ])
      expect(() => optinToolPath(input, templateConfig)).toThrow('Invalid reading source')
  })
})
