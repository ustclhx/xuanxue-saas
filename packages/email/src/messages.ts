import type { EmailLocale } from './locale.ts'

/** 各模板的输入（必须可 JSON 序列化：3.2 会把它放进 EMAIL_QUEUE 消息）。 */
export interface EmailTemplateProps {
  'waitlist-invitation': { readonly url: string }
  'newsletter-confirmation': { readonly url: string }
  newsletter: { readonly subject: string; readonly body: string; readonly unsubscribeUrl: string }

  'refund-update': {
    readonly status: 'approved' | 'rejected' | 'refunded'
    readonly amount: number | null
    readonly currency: string
    readonly note: string
    readonly supportEmail: string
  }

  /** 注册后的邮箱验证 */
  'verify-email': { readonly url: string }
  /** 邮箱验证码（emailOTP 插件），用途决定文案 */
  otp: { readonly otp: string; readonly purpose: OtpPurpose; readonly expiresInMinutes: number }
  /** 魔法链接登录 */
  'magic-link': { readonly url: string; readonly expiresInMinutes: number }
  /** 找回密码 */
  'reset-password': { readonly url: string; readonly expiresInMinutes: number }
  /** 团队空间邀请 */
  'workspace-invitation': {
    readonly url: string
    readonly workspaceName: string
    readonly inviterName: string
    readonly role: InvitationRole
    readonly expiresInDays: number
  }
}

export type EmailTemplateName = keyof EmailTemplateProps

/** 与 Better Auth emailOTP 插件 `sendVerificationOTP` 的 `type` 一致 */
export type OtpPurpose = 'sign-in' | 'email-verification' | 'forget-password'
/** 自定义团队后端支持的邀请角色 */
export type InvitationRole = 'owner' | 'admin' | 'member'

/** 所有模板共用的上下文 */
export interface CopyContext {
  readonly appName: string
  /** 收件人称呼；缺省时使用通用问候 */
  readonly recipientName?: string | undefined
}

/** 一封邮件的文案；渲染时由统一布局（templates/layout.tsx）排版。 */
export interface EmailCopy {
  readonly subject: string
  /** 收件箱列表中显示的预览文字 */
  readonly preview: string
  readonly heading: string
  readonly greeting: string
  readonly paragraphs: readonly string[]
  /** 按钮；有按钮时同时显示可复制的链接 */
  readonly action?: { readonly label: string; readonly url: string }
  /** 验证码 */
  readonly code?: string
  /** 按钮无法点击时的提示 */
  readonly linkHint: string
  /** 页脚：非本人操作时的说明 */
  readonly footer: string
}

type CopyBuilders = {
  readonly [N in EmailTemplateName]: (props: EmailTemplateProps[N], ctx: CopyContext) => EmailCopy
}

const minutesEn = (n: number) => (n === 1 ? '1 minute' : `${n} minutes`)
const daysEn = (n: number) => (n === 1 ? '1 day' : `${n} days`)

const en: CopyBuilders = {
  'waitlist-invitation': ({ url }, { appName, recipientName }) => ({
    subject: `You are invited to ${appName}`,
    preview: 'Your registration invitation is ready.',
    heading: 'You are invited',
    greeting: greetingEn(recipientName),
    paragraphs: [
      'Use this link to create your account, even while registration is closed. This invitation expires in 7 days.',
    ],
    action: { label: 'Create account', url },
    linkHint: 'Copy this link if the button does not work:',
    footer: 'If you did not join the waitlist, ignore this email.',
  }),
  'newsletter-confirmation': ({ url }, { appName, recipientName }) => ({
    subject: `Confirm your ${appName} subscription`,
    preview: 'Confirm to receive our newsletter.',
    heading: 'Confirm your subscription',
    greeting: greetingEn(recipientName),
    paragraphs: [
      'Click below to subscribe. You will only receive newsletters after confirming. This link expires in 24 hours.',
    ],
    action: { label: 'Confirm subscription', url },
    linkHint: 'Copy this link if the button does not work:',
    footer: 'If you did not subscribe, ignore this email.',
  }),
  newsletter: ({ subject, body, unsubscribeUrl }, { recipientName }) => ({
    subject,
    preview: subject,
    heading: subject,
    greeting: greetingEn(recipientName),
    paragraphs: [body],
    action: { label: 'Unsubscribe', url: unsubscribeUrl },
    linkHint: 'You can unsubscribe with this link:',
    footer: 'You received this email because you confirmed your subscription.',
  }),

  'refund-update': (
    { status, amount, currency, note, supportEmail },
    { appName, recipientName },
  ) => ({
    subject: `Your ${appName} refund request: ${status}`,
    preview: `Your refund request is ${status}.`,
    heading: 'Refund request update',
    greeting: greetingEn(recipientName),
    paragraphs: [
      status === 'approved'
        ? 'Your request was approved. The refund is not yet confirmed by the payment provider.'
        : status === 'refunded'
          ? 'The payment provider has confirmed your refund.'
          : 'Your refund request was rejected.',
      ...(amount === null ? [] : [`Amount: ${(amount / 100).toFixed(2)} ${currency}.`]),
      ...(note ? [note] : []),
      `For help, contact ${supportEmail}.`,
    ],
    linkHint: '',
    footer: 'This update remains available by email if you have deleted your account.',
  }),

  'verify-email': ({ url }, { appName, recipientName }) => ({
    subject: `Verify your email for ${appName}`,
    preview: `Confirm your email address to finish setting up your ${appName} account.`,
    heading: 'Verify your email',
    greeting: greetingEn(recipientName),
    paragraphs: [
      `Thanks for signing up for ${appName}. Please confirm your email address by clicking the button below.`,
    ],
    action: { label: 'Verify email', url },
    linkHint: 'If the button does not work, copy and paste this link into your browser:',
    footer: `If you did not create a ${appName} account, you can safely ignore this email.`,
  }),
  otp: ({ otp, purpose, expiresInMinutes }, { appName, recipientName }) => {
    const purposeText = {
      'sign-in': `sign in to ${appName}`,
      'email-verification': `verify your email for ${appName}`,
      'forget-password': `reset your ${appName} password`,
    }[purpose]
    return {
      subject: `${otp} is your ${appName} verification code`,
      preview: `Use this code to ${purposeText}.`,
      heading: 'Your verification code',
      greeting: greetingEn(recipientName),
      paragraphs: [
        `Use the code below to ${purposeText}. It expires in ${minutesEn(expiresInMinutes)}.`,
      ],
      code: otp,
      linkHint: '',
      footer:
        'Never share this code with anyone. If you did not request it, you can ignore this email.',
    }
  },
  'magic-link': ({ url, expiresInMinutes }, { appName, recipientName }) => ({
    subject: `Sign in to ${appName}`,
    preview: `Your sign-in link for ${appName}.`,
    heading: `Sign in to ${appName}`,
    greeting: greetingEn(recipientName),
    paragraphs: [
      `Click the button below to sign in. This link expires in ${minutesEn(expiresInMinutes)} and can only be used once.`,
    ],
    action: { label: 'Sign in', url },
    linkHint: 'If the button does not work, copy and paste this link into your browser:',
    footer: 'If you did not request this link, you can safely ignore this email.',
  }),
  'reset-password': ({ url, expiresInMinutes }, { appName, recipientName }) => ({
    subject: `Reset your ${appName} password`,
    preview: `Follow this link to choose a new password for ${appName}.`,
    heading: 'Reset your password',
    greeting: greetingEn(recipientName),
    paragraphs: [
      `We received a request to reset the password for your ${appName} account. Click the button below to choose a new password. This link expires in ${minutesEn(expiresInMinutes)}.`,
    ],
    action: { label: 'Reset password', url },
    linkHint: 'If the button does not work, copy and paste this link into your browser:',
    footer:
      'If you did not request a password reset, you can ignore this email; your password will not change.',
  }),
  'workspace-invitation': (
    { url, workspaceName, inviterName, role, expiresInDays },
    { appName, recipientName },
  ) => ({
    subject: `${inviterName} invited you to join ${workspaceName} on ${appName}`,
    preview: `Join the ${workspaceName} workspace on ${appName}.`,
    heading: `Join ${workspaceName}`,
    greeting: greetingEn(recipientName),
    paragraphs: [
      `${inviterName} has invited you to join the ${workspaceName} workspace on ${appName} as ${{ owner: 'an owner', admin: 'an admin', member: 'a member' }[role]}.`,
      `This invitation expires in ${daysEn(expiresInDays)}.`,
    ],
    action: { label: 'Accept invitation', url },
    linkHint: 'If the button does not work, copy and paste this link into your browser:',
    footer: 'If you were not expecting this invitation, you can ignore this email.',
  }),
}

const zhHant: CopyBuilders = {
  'waitlist-invitation': ({ url }, { appName, recipientName }) => ({
    subject: `邀請你註冊 ${appName}`,
    preview: '你的註冊邀請已就緒。',
    heading: '註冊邀請',
    greeting: greetingZh(recipientName),
    paragraphs: ['即使註冊尚未開放，你也可以透過此連結建立帳號。邀請 7 天內有效。'],
    action: { label: '建立帳號', url },
    linkHint: '如果按鈕無法點選，請複製此連結：',
    footer: '如果你沒有加入等候名單，請忽略這封郵件。',
  }),
  'newsletter-confirmation': ({ url }, { appName, recipientName }) => ({
    subject: `確認訂閱 ${appName} 通訊`,
    preview: '確認後才能收到郵件通訊。',
    heading: '確認訂閱',
    greeting: greetingZh(recipientName),
    paragraphs: ['請點選下方按鈕確認訂閱。確認後才會收到通訊郵件。連結 24 小時內有效。'],
    action: { label: '確認訂閱', url },
    linkHint: '如果按鈕無法點選，請複製此連結：',
    footer: '如果你沒有訂閱，請忽略這封郵件。',
  }),
  newsletter: ({ subject, body, unsubscribeUrl }, { recipientName }) => ({
    subject,
    preview: subject,
    heading: subject,
    greeting: greetingZh(recipientName),
    paragraphs: [body],
    action: { label: '退訂', url: unsubscribeUrl },
    linkHint: '你可以透過此連結退訂：',
    footer: '你收到此郵件是因為已確認訂閱。',
  }),

  'refund-update': (
    { status, amount, currency, note, supportEmail },
    { appName, recipientName },
  ) => ({
    subject: `${appName} 退款申請：${{ approved: '已批准', rejected: '已駁回', refunded: '已退款' }[status]}`,
    preview: `退款申請${{ approved: '已批准，待平台確認', rejected: '已駁回', refunded: '已由平台確認退款' }[status]}。`,
    heading: '退款申請進度',
    greeting: greetingZh(recipientName),
    paragraphs: [
      status === 'approved'
        ? '申請已批准，退款尚待付款平台確認。'
        : status === 'refunded'
          ? '付款平台已確認退款。'
          : '退款申請已駁回。',
      ...(amount === null ? [] : [`金額：${(amount / 100).toFixed(2)} ${currency}。`]),
      ...(note ? [note] : []),
      `如需協助，請聯絡 ${supportEmail}。`,
    ],
    linkHint: '',
    footer: '刪除帳號後，退款結果仍會傳送至申請時儲存的聯絡電子郵件。',
  }),

  'verify-email': ({ url }, { appName, recipientName }) => ({
    subject: `驗證你的 ${appName} 電子郵件`,
    preview: `確認電子郵件地址，完成 ${appName} 帳號註冊。`,
    heading: '驗證你的電子郵件',
    greeting: greetingZh(recipientName),
    paragraphs: [`感謝註冊 ${appName}。請點選下方按鈕確認你的電子郵件地址。`],
    action: { label: '驗證電子郵件', url },
    linkHint: '如果按鈕無法點選，請將以下連結複製到瀏覽器中開啟：',
    footer: `如果你沒有註冊 ${appName} 帳號，請忽略這封郵件。`,
  }),
  otp: ({ otp, purpose, expiresInMinutes }, { appName, recipientName }) => {
    const purposeText = {
      'sign-in': `登入 ${appName}`,
      'email-verification': `驗證你的 ${appName} 電子郵件`,
      'forget-password': `重設 ${appName} 密碼`,
    }[purpose]
    return {
      subject: `${otp} 是你的 ${appName} 驗證碼`,
      preview: `使用此驗證碼${purposeText}。`,
      heading: '你的驗證碼',
      greeting: greetingZh(recipientName),
      paragraphs: [`請使用以下驗證碼${purposeText}，驗證碼 ${expiresInMinutes} 分鐘內有效。`],
      code: otp,
      linkHint: '',
      footer: '請勿將驗證碼告訴任何人。如果這不是你本人的操作，請忽略這封郵件。',
    }
  },
  'magic-link': ({ url, expiresInMinutes }, { appName, recipientName }) => ({
    subject: `登入 ${appName}`,
    preview: `你的 ${appName} 登入連結。`,
    heading: `登入 ${appName}`,
    greeting: greetingZh(recipientName),
    paragraphs: [`點選下方按鈕即可登入。連結 ${expiresInMinutes} 分鐘內有效，且只能使用一次。`],
    action: { label: '登入', url },
    linkHint: '如果按鈕無法點選，請將以下連結複製到瀏覽器中開啟：',
    footer: '如果這不是你本人的操作，請忽略這封郵件。',
  }),
  'reset-password': ({ url, expiresInMinutes }, { appName, recipientName }) => ({
    subject: `重設你的 ${appName} 密碼`,
    preview: `透過此連結為 ${appName} 帳號設定新密碼。`,
    heading: '重設密碼',
    greeting: greetingZh(recipientName),
    paragraphs: [
      `我們收到了重設你 ${appName} 帳號密碼的請求。請點選下方按鈕設定新密碼，連結 ${expiresInMinutes} 分鐘內有效。`,
    ],
    action: { label: '重設密碼', url },
    linkHint: '如果按鈕無法點選，請將以下連結複製到瀏覽器中開啟：',
    footer: '如果這不是你本人的操作，請忽略這封郵件，你的密碼不會改變。',
  }),
  'workspace-invitation': (
    { url, workspaceName, inviterName, role, expiresInDays },
    { appName, recipientName },
  ) => ({
    subject: `${inviterName} 邀請你加入 ${appName} 上的 ${workspaceName}`,
    preview: `加入 ${appName} 上的 ${workspaceName} 空間。`,
    heading: `加入 ${workspaceName}`,
    greeting: greetingZh(recipientName),
    paragraphs: [
      `${inviterName} 邀請你以${{ owner: '所有者', admin: '管理員', member: '成員' }[role]}身份加入 ${appName} 上的 ${workspaceName} 空間。`,
      `邀請 ${expiresInDays} 天內有效。`,
    ],
    action: { label: '接受邀請', url },
    linkHint: '如果按鈕無法點選，請將以下連結複製到瀏覽器中開啟：',
    footer: '如果你不認識邀請人，請忽略這封郵件。',
  }),
}

const ko: CopyBuilders = {
  'waitlist-invitation': ({ url }, { appName, recipientName }) => ({
    subject: `${appName}에 초대합니다`,
    preview: '가입 초대가 준비되었습니다.',
    heading: '가입 초대',
    greeting: greetingKo(recipientName),
    paragraphs: [
      '가입이 아직 열리지 않았더라도 이 링크로 계정을 만들 수 있습니다. 초대는 7일 동안 유효합니다.',
    ],
    action: { label: '계정 만들기', url },
    linkHint: '버튼이 작동하지 않으면 이 링크를 복사하세요:',
    footer: '대기자 명단에 등록한 적이 없다면 이 메일을 무시하세요.',
  }),
  'newsletter-confirmation': ({ url }, { appName, recipientName }) => ({
    subject: `${appName} 뉴스레터 구독을 확인해 주세요`,
    preview: '구독을 확인해야 뉴스레터를 받을 수 있습니다.',
    heading: '구독 확인',
    greeting: greetingKo(recipientName),
    paragraphs: [
      '아래 버튼을 눌러 구독을 확인하세요. 확인한 후에만 뉴스레터가 발송됩니다. 링크는 24시간 동안 유효합니다.',
    ],
    action: { label: '구독 확인', url },
    linkHint: '버튼이 작동하지 않으면 이 링크를 복사하세요:',
    footer: '구독한 적이 없다면 이 메일을 무시하세요.',
  }),
  newsletter: ({ subject, body, unsubscribeUrl }, { recipientName }) => ({
    subject,
    preview: subject,
    heading: subject,
    greeting: greetingKo(recipientName),
    paragraphs: [body],
    action: { label: '구독 취소', url: unsubscribeUrl },
    linkHint: '이 링크로 구독을 취소할 수 있습니다:',
    footer: '구독을 확인하셨기 때문에 이 메일을 받으셨습니다.',
  }),

  'refund-update': (
    { status, amount, currency, note, supportEmail },
    { appName, recipientName },
  ) => ({
    subject: `${appName} 환불 요청: ${{ approved: '승인됨', rejected: '거절됨', refunded: '환불 완료' }[status]}`,
    preview: `환불 요청이 ${{ approved: '승인되어 결제 서비스의 확인을 기다리고 있습니다', rejected: '거절되었습니다', refunded: '결제 서비스에서 환불 처리되었습니다' }[status]}.`,
    heading: '환불 요청 진행 상황',
    greeting: greetingKo(recipientName),
    paragraphs: [
      status === 'approved'
        ? '요청이 승인되었습니다. 결제 서비스에서 아직 환불을 확인하지 않았습니다.'
        : status === 'refunded'
          ? '결제 서비스에서 환불을 확인했습니다.'
          : '환불 요청이 거절되었습니다.',
      ...(amount === null ? [] : [`금액: ${(amount / 100).toFixed(2)} ${currency}.`]),
      ...(note ? [note] : []),
      `도움이 필요하시면 ${supportEmail}(으)로 문의하세요.`,
    ],
    linkHint: '',
    footer: '계정을 삭제하더라도 환불 결과는 요청 시 남긴 연락용 이메일로 발송됩니다.',
  }),

  'verify-email': ({ url }, { appName, recipientName }) => ({
    subject: `${appName} 이메일 주소를 인증해 주세요`,
    preview: `이메일 주소를 확인하고 ${appName} 가입을 완료하세요.`,
    heading: '이메일 인증',
    greeting: greetingKo(recipientName),
    paragraphs: [
      `${appName}에 가입해 주셔서 감사합니다. 아래 버튼을 눌러 이메일 주소를 확인하세요.`,
    ],
    action: { label: '이메일 인증', url },
    linkHint: '버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여 넣으세요:',
    footer: `${appName}에 가입한 적이 없다면 이 메일을 무시하세요.`,
  }),
  otp: ({ otp, purpose, expiresInMinutes }, { appName, recipientName }) => {
    const purposeText = {
      'sign-in': `${appName}에 로그인하려면`,
      'email-verification': `${appName} 이메일을 인증하려면`,
      'forget-password': `${appName} 비밀번호를 재설정하려면`,
    }[purpose]
    return {
      subject: `${appName} 인증 코드: ${otp}`,
      preview: `${purposeText} 이 코드를 입력하세요.`,
      heading: '인증 코드',
      greeting: greetingKo(recipientName),
      paragraphs: [
        `${purposeText} 아래 코드를 입력하세요. 코드는 ${expiresInMinutes}분 동안 유효합니다.`,
      ],
      code: otp,
      linkHint: '',
      footer:
        '이 코드를 다른 사람에게 알려 주지 마세요. 직접 요청하지 않았다면 이 메일을 무시하세요.',
    }
  },
  'magic-link': ({ url, expiresInMinutes }, { appName, recipientName }) => ({
    subject: `${appName} 로그인`,
    preview: `${appName} 로그인 링크입니다.`,
    heading: `${appName} 로그인`,
    greeting: greetingKo(recipientName),
    paragraphs: [
      `아래 버튼을 눌러 로그인하세요. 링크는 ${expiresInMinutes}분 동안 유효하며 한 번만 사용할 수 있습니다.`,
    ],
    action: { label: '로그인', url },
    linkHint: '버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여 넣으세요:',
    footer: '직접 요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
  }),
  'reset-password': ({ url, expiresInMinutes }, { appName, recipientName }) => ({
    subject: `${appName} 비밀번호 재설정`,
    preview: `이 링크로 ${appName} 계정의 새 비밀번호를 설정하세요.`,
    heading: '비밀번호 재설정',
    greeting: greetingKo(recipientName),
    paragraphs: [
      `${appName} 계정의 비밀번호 재설정 요청을 받았습니다. 아래 버튼을 눌러 새 비밀번호를 설정하세요. 링크는 ${expiresInMinutes}분 동안 유효합니다.`,
    ],
    action: { label: '비밀번호 재설정', url },
    linkHint: '버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여 넣으세요:',
    footer: '직접 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 변경되지 않습니다.',
  }),
  'workspace-invitation': (
    { url, workspaceName, inviterName, role, expiresInDays },
    { appName, recipientName },
  ) => ({
    subject: `${inviterName} 님이 ${appName}의 ${workspaceName}에 초대했습니다`,
    preview: `${appName}의 ${workspaceName} 워크스페이스에 참여하세요.`,
    heading: `${workspaceName} 참여하기`,
    greeting: greetingKo(recipientName),
    paragraphs: [
      `${inviterName} 님이 ${appName}의 ${workspaceName} 워크스페이스에 ${{ owner: '소유자', admin: '관리자', member: '구성원' }[role]}(으)로 초대했습니다.`,
      `초대는 ${expiresInDays}일 동안 유효합니다.`,
    ],
    action: { label: '초대 수락', url },
    linkHint: '버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여 넣으세요:',
    footer: '초대를 예상하지 못했다면 이 메일을 무시하세요.',
  }),
}

function greetingEn(name: string | undefined): string {
  return name ? `Hi ${name},` : 'Hi,'
}

function greetingZh(name: string | undefined): string {
  return name ? `${name}，你好：` : '你好：'
}

function greetingKo(name: string | undefined): string {
  return name ? `${name} 님, 안녕하세요.` : '안녕하세요.'
}

export const copies: { readonly [L in EmailLocale]: CopyBuilders } = { en, 'zh-Hant': zhHant, ko }
