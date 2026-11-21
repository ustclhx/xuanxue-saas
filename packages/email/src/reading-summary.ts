import type { EmailLocale } from './locale.ts'
import type { EmailCopy, EmailTemplateProps } from './messages.ts'

const labels = {
  en: {
    greeting: 'Hello',
    result: 'Reopen this result',
    unlock: 'Explore the full reading',
    unsubscribe: 'Unsubscribe',
    footer: 'You received this reading because you confirmed your subscription.',
  },
  'zh-Hant': {
    greeting: '你好',
    result: '重新查看這次結果',
    unlock: '查看完整分析入口',
    unsubscribe: '退訂',
    footer: '你收到這封解讀，是因為你已確認訂閱。',
  },
  'zh-Hans': {
    greeting: '你好',
    result: '重新查看这次结果',
    unlock: '查看完整分析入口',
    unsubscribe: '退订',
    footer: '你收到这封解读，是因为你已确认订阅。',
  },
  ko: {
    greeting: '안녕하세요',
    result: '이번 결과 다시 보기',
    unlock: '상세 풀이 살펴보기',
    unsubscribe: '구독 취소',
    footer: '구독을 확인하셨기 때문에 이 풀이를 받으셨습니다.',
  },
  es: {
    greeting: 'Hola',
    result: 'Volver a ver este resultado',
    unlock: 'Conoce la lectura completa',
    unsubscribe: 'Cancelar suscripción',
    footer: 'Recibes esta lectura porque confirmaste tu suscripción.',
  },
  ja: {
    greeting: 'こんにちは',
    result: '今回の結果をもう一度見る',
    unlock: '詳しい鑑定を見る',
    unsubscribe: '配信停止',
    footer: '購読を確認いただいたため、この鑑定メールをお送りしています。',
  },
} as const

export function readingSummaryCopy(
  locale: EmailLocale,
  props: EmailTemplateProps['reading-summary'],
): EmailCopy {
  const copy = labels[locale]
  return {
    subject: props.subject,
    preview: props.subject,
    heading: props.subject,
    // 日语以「〇〇 様」称呼，不用「こんにちは, 名前」的英文语序
    greeting: props.name
      ? locale === 'ja'
        ? `${props.name} 様`
        : `${copy.greeting}, ${props.name}`
      : copy.greeting,
    paragraphs: [...props.paragraphs, props.disclaimer],
    links: [
      { label: copy.result, url: props.resultUrl },
      { label: copy.unlock, url: props.unlockUrl },
      { label: copy.unsubscribe, url: props.unsubscribeUrl },
    ],
    linkHint: '',
    footer: copy.footer,
  }
}
