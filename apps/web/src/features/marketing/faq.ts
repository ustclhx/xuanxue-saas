import { m } from '../../paraglide/messages.js'
import type { Locale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { siteAccountNames } from '../auth/site-account-names.ts'
import { siteOfLocale } from '../site/site.ts'
import type { QA } from '../tools/numerology/seo.ts'

export interface FaqSection {
  readonly title: string
  readonly items: readonly QA[]
}

type Message = (inputs: Record<string, never>, options: { locale: Locale }) => string
type Pair = readonly [Message, Message]

// 各站点各语言实际提供的工具不同：东方站繁简为八字 / 紫微 / 命盘，韩语为만세력 / 궁합，西方站为灵数；
// 问答直接复用定价页与工具页 FAQ 的文案，页面与 FAQPage 结构化数据共用同一份数据。
const METHODS: Record<Locale, readonly Pair[]> = {
  en: [
    [m.numerology_faq_calc_q1, m.numerology_faq_calc_a1],
    [m.numerology_faq_name_q2, m.numerology_faq_name_a2],
    [m.numerology_faq_compat_q1, m.numerology_faq_compat_a1],
  ],
  'zh-Hant': [
    [m.bazi_home_faq_q1, m.bazi_home_faq_a1],
    [m.bazi_ziwei_faq_q1, m.bazi_ziwei_faq_a1],
    [m.bazi_ziwei_faq_q2, m.bazi_ziwei_faq_a2],
    [m.bazi_mingpan_faq_q2, m.bazi_mingpan_faq_a2],
  ],
  'zh-Hans': [
    [m.bazi_home_faq_q1, m.bazi_home_faq_a1],
    [m.bazi_ziwei_faq_q1, m.bazi_ziwei_faq_a1],
    [m.bazi_ziwei_faq_q2, m.bazi_ziwei_faq_a2],
    [m.bazi_mingpan_faq_q2, m.bazi_mingpan_faq_a2],
  ],
  ko: [
    [m.bazi_home_faq_q1, m.bazi_home_faq_a1],
    [m.bazi_home_faq_q3, m.bazi_home_faq_a3],
    [m.bazi_gunghap_faq_q1, m.bazi_gunghap_faq_a1],
  ],
}

/** /faq 汇总页：积分与退款（关闭计费时省略）、隐私与计算方式、账号三组问答 */
export function faqSections(locale: Locale): FaqSection[] {
  const options = { locale }
  const qa = ([question, answer]: Pair): QA => ({
    question: question({}, options),
    answer: answer({}, options),
  })
  const days = String(templateConfig.billing.refundWindowDays)
  const names = siteAccountNames(siteOfLocale(locale, templateConfig) ?? 'west', locale)
  const credits: FaqSection[] = templateConfig.billing.enabled
    ? [
        {
          title: m.marketing_faq_section_credits({}, options),
          items: [
            qa([m.pricing_faq_free_q, m.pricing_faq_free_a]),
            qa([m.pricing_faq_fail_q, m.pricing_faq_fail_a]),
            {
              question: m.pricing_faq_refund_q({}, options),
              answer: m.pricing_faq_refund_a({ days }, options),
            },
            qa([m.pricing_faq_pay_q, m.pricing_faq_pay_a]),
            // 订阅积分不结转、取消方式与取消后的权益（enable-subscriptions-daily-credits 4.5）
            qa([m.pricing_faq_sub_rollover_q, m.pricing_faq_sub_rollover_a]),
            {
              question: m.pricing_faq_sub_cancel_q({}, options),
              answer: m.pricing_faq_sub_cancel_a({ days }, options),
            },
            // 每日积分的领取规则与两站共享额度（enable-subscriptions-daily-credits D6）
            ...(templateConfig.credits.enabled && templateConfig.credits.dailyEnabled
              ? [
                  {
                    question: m.daily_credits_faq_q({}, options),
                    answer: m.daily_credits_faq_a(names, options),
                  },
                ]
              : []),
          ],
        },
      ]
    : []
  return [
    ...credits,
    {
      title: m.marketing_faq_section_methods({}, options),
      items: [
        qa([m.marketing_faq_privacy_q, m.marketing_faq_privacy_a]),
        ...METHODS[locale].map(qa),
        qa([m.tarot_three_card_faq_2_q, m.tarot_three_card_faq_2_a]),
        qa([m.pricing_faq_accuracy_q, m.pricing_faq_accuracy_a]),
      ],
    },
    {
      // 两站账户分开（split-site-accounts D3）：语言只属于一个站点，按语言取本站与另一站的品牌名
      title: m.marketing_faq_section_account({}, options),
      items: [
        {
          question: m.marketing_faq_accounts_q(names, options),
          answer: m.marketing_faq_accounts_a(names, options),
        },
      ],
    },
  ]
}
