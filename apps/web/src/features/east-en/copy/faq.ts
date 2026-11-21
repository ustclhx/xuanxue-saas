import type { FaqPageCopy } from './types.ts'

// 东方站英文 FAQ 页：按事实单直接用英文写作（openspec add-locales-eu-ja 5b）。积分、隐私与账号组的事实
// 与两站共用的定价规则一致（退款 30 天、积分包 365 天、每日积分 5 个 / 每月 10 天 / 7 天有效），文字为本站自己的写法。
export const FAQ_PAGE: FaqPageCopy = {
  h1: 'Frequently asked questions',
  intro:
    'How the charts and tarot tools on Ganjiday are calculated, what they can and cannot tell you, and how credits, privacy and your account work.',
  methodsTitle: 'Charts, tarot and accuracy',
  methods: [
    {
      q: 'Purple Star Astrology vs BaZi: what is the difference?',
      a: 'Both start from your birth date and hour. BaZi turns them into four pillars and reads the balance of the five elements around your Day Master. Purple Star Astrology places 14 main stars in twelve palaces, one for each area of life. Our [BaZi calculator](bazi) works without a birth time; the [Zi Wei Dou Shu chart](ziwei) needs one.',
      origin: 'local',
    },
    {
      q: 'How accurate is a BaZi chart?',
      a: 'The calculation is rule-based: solar terms for months, the Beginning of Spring for the year, and your birth city’s time zone history for the hour. How you interpret the chart is a matter of tradition and judgment, and schools differ on some conventions. We present charts for reference and self-reflection; they do not predict events.',
      origin: 'local',
    },
    {
      q: 'Does the BaZi calculator use my birth location?',
      a: 'Yes. Your birth city sets the time zone and removes any daylight saving time from that date. You can also turn on true solar time, which corrects the hour for longitude. The free chart is calculated in your browser, on your own device.',
      origin: 'local',
    },
    {
      q: 'How is the tarot draw done?',
      a: 'Cards are shuffled and drawn at random in your browser, and each card is set upright or reversed on its own. Answers in the pick a card tarot spread come from a fixed yes, no or maybe for every card and orientation, so nothing is adjusted after you draw.',
      origin: 'adapted',
    },
    {
      q: 'Where do the optional written readings come from?',
      a: 'If you ask for a full reading, it is written by AI from your finished chart or cards and uses credits. The charts and draws themselves are free and do not need an account. Readings are meant for reflection, not as advice or a forecast.',
      origin: 'adapted',
    },
  ],
  sections: [
    {
      title: 'Credits, payments and refunds',
      items: [
        {
          q: 'Is the BaZi calculator really free?',
          a: 'Yes. Every chart and every tarot spread on Ganjiday shows its full standard result without an account or a payment. Credits are only spent when you ask for an optional written reading of your own chart or cards; see [BaZi reading pricing](pricing).',
          origin: 'local',
        },
        {
          q: 'How do the free daily credits work?',
          a: 'A new account receives 15 credits once its email address is confirmed, plus 5 credits for that first day. After that, opening your account area on a new day (UTC) adds 5 credits, on up to 10 days each month, as long as the email is verified. These daily credits last 7 days and are spent before any others. If you also have an account on our sister site under the same email, the two share a single daily claim and monthly limit.',
          origin: 'adapted',
        },
        {
          q: 'What happens to my credits if a reading goes wrong?',
          a: 'A reading that stops part-way or fails to finish is marked as failed, and the credits it used go straight back to your balance, so you can run it again at no cost.',
          origin: 'adapted',
        },
        {
          q: 'How long do purchased credits last, and can I get my money back?',
          a: 'Credits from a one-time pack stay usable for 365 days. You can ask for a refund of unused credits within 30 days of paying; the [Refund Policy](refund) explains the steps. Subscription credits are tied to their billing month and expire 24 hours after it ends, while a renewal adds a new month’s worth.',
          origin: 'local',
        },
        {
          q: 'Which payment methods can I use?',
          a: 'Cards are handled by Stripe, and PayPal is also available. Ganjiday never receives or keeps your card number. A subscription can be canceled at any time from the Billing page; it simply does not renew, and you keep that month’s credits until the period closes.',
          origin: 'adapted',
        },
      ],
    },
    {
      title: 'Privacy and your account',
      items: [
        {
          q: 'Do you store my birth date and time?',
          a: 'Not when you use the free tools: the chart is worked out inside your browser. Your birth details reach our servers only if you sign in and either unlock a written reading or save a birth profile, because both need them. The [Privacy Policy](privacy) lists what we keep and for how long.',
          origin: 'local',
        },
        {
          q: 'Does my Ganjiday account work anywhere else?',
          a: 'No. Your Ganjiday sign-in, credits, purchases and saved readings belong to this site only. The single exception is the shared daily credit claim described above.',
          origin: 'adapted',
        },
      ],
    },
  ],
}
