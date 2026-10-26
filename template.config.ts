import { defineTemplateConfig } from '@xuanxue/config'

/**
 * 模板配置：功能开关与产品形态，改代码、重新部署才生效（docs/02-project-structure.md §3）。
 * 省略的项取 `@xuanxue/config` 中的默认值；密钥与可在后台修改的运行时设置不放在这里。
 * apps/web 经 `apps/web/src/server/template-config.ts` 读取。
 */
export default defineTemplateConfig({
  app: {
    // 未区分站点的场景（如认证库内部、无语言的邮件）使用西方站品牌与联系邮箱
    name: 'Arcanumber',
    url: 'https://arcanumber.com',
    supportEmail: 'support@arcanumber.com',
  },
  i18n: { enabled: true, locales: ['en', 'zh-Hant', 'zh-Hans', 'ko'], defaultLocale: 'en' },
  // 站点注册表：同一个 Worker 按 Host 区分东方站与西方站，每种语言只属于一个站点。
  // 第一个 host 为规范域名；www 由 Cloudflare 重定向规则跳到裸域（决策 D2，docs/v1-decisions.md）。
  // 两站品牌分开，搜索引擎不把两站视为同一实体（launch-v1-production design）。
  sites: {
    // 东方站没有无前缀的默认语言，根路径为语言入口页；后续加入 ja
    east: {
      hosts: ['ganjiday.com'],
      locales: ['zh-Hant', 'zh-Hans', 'ko'],
      defaultLocale: null,
      brand: {
        name: 'Ganjiday',
        names: { 'zh-Hant': '干支日', 'zh-Hans': '干支日', ko: '간지데이' },
      },
      // Cloudflare Email Routing 转发到运营者邮箱（D6：不公开个人邮箱与地址）
      supportEmail: 'support@ganjiday.com',
      // Cloudflare Web Analytics 手动片段的公开 site token（无 Cookie，仅公开页面加载）
      analyticsToken: '21bda25feef743088c8ca9fb63b76a36',
    },
    // 后续加入 fr / de / nl / it，各语言统一使用 Arcanumber
    west: {
      hosts: ['arcanumber.com'],
      locales: ['en'],
      defaultLocale: 'en',
      brand: { name: 'Arcanumber' },
      analyticsToken: 'aa32b146781b4880aa9686d85c3a8f66',
    },
  },
  tenancy: {
    multiTenant: false, // false = 仅个人空间；true = 允许团队 workspace
    maxWorkspacesPerUser: 5,
  },
  auth: {
    emailPassword: true,
    requireEmailVerification: false, // 邮箱密码注册是否必须先验证邮箱才能登录；默认否，领取注册赠送积分时才要求验证
    emailOtp: true, // 邮箱验证码登录（emailOTP 插件）
    magicLink: false, // 魔法链接登录（magicLink 插件）
    oauth: ['google'],
    twoFactor: false,
    turnstile: true,
  },
  billing: {
    enabled: true, // 计费依赖积分；关闭计费时同时关闭 AI
    providers: ['paypal'], // 结账页展示顺序
    currency: 'usd',
    signupBonusCredits: 0, // 不送注册积分，避免注册即白拿一次详批（add-reading-monetization 决策 4）
    pastDueGraceDays: 7, // past_due 期间保留权益的天数
    subscriptionCreditGraceHours: 24, // 订阅积分批次在周期末之后的额外有效期
    overage: {
      // 实际消耗超出预扣时平台承担的上限，超出部分从余额补扣 / 记欠费
      maxRatio: 0.2, // 单次最多承担预扣额的 20%
      maxCredits: 50, // 单次最多承担 50 积分
      dailyBudgetPerWorkspace: 200, // 每个空间每天最多承担 200 积分
    },
    refundWindowDays: 30, // 可申请退款的付款时间范围；退款需人工审核，默认不主动退
  },
  credits: { enabled: true },
  marketing: { enabled: true },
  ai: {
    text: {
      enabled: true,
      thinking: { default: 'off', userToggle: false },
      reasoning: { display: false },
      failedReplyRefund: 'no-visible-output',
    },
    image: false,
    video: false,
    mediaProviders: ['fal', 'workers-ai'], // 只启用需要的媒体服务商；Workers AI 使用 AI 绑定，无外部密钥
    // 新建模型时的默认计费方式，后台可逐个模型修改：'per_call' 按次 | 'token' 按 token | 'per_unit' 按张/秒
    defaultPricingMode: { text: 'token', image: 'per_call', video: 'per_call' },
  },
  features: { publicApi: false, blog: true, docs: false, waitlist: false, newsletter: true },
})
