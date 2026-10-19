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
  ko: {
    greeting: '안녕하세요',
    result: '이번 결과 다시 보기',
    unlock: '상세 풀이 살펴보기',
    unsubscribe: '구독 취소',
    footer: '구독을 확인하셨기 때문에 이 풀이를 받으셨습니다.',
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
    greeting: props.name ? `${copy.greeting}, ${props.name}` : copy.greeting,
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
