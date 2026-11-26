// 项目自有：模板只创建本文件，之后不再修改（template-release 检查），template-sync 不会在这里冲突。
// 后台重新验证（step-up）的项目扩展点，只在 server function 内调用（service.server.ts）：
//   - stepUpVerificationColumns：写 `verification` 表时追加的列。衍生项目给该表加了必填列
//     （例如多站点的 `site`）时在这里返回；模板写入的列优先，同名键不会覆盖模板列。
//     每次发码或校验在事务前调用一次，可以查库（事务内不会另取连接）。
//   - stepUpEmailBrand：验证码邮件使用的应用名与站点地址，默认取模板配置与 APP_URL；
//     多站点项目可按请求的 Host 或用户所在站点返回对应品牌。
//
// 本项目（xuanxue，两站账户隔离，openspec split-site-accounts 决策 2）：
//   - `verification.site` 为必填列，写入管理员账户所在站点；
//   - 验证码邮件使用请求 Host 所在站点的品牌（干支日 / Arcanumber），品牌名按收件人语言本地化（stepUpBrandName）。
import type { SiteId } from '@xuanxue/config'
import { siteBrandName } from '@xuanxue/config'
import { type Database, user } from '@xuanxue/db'
import { eq } from 'drizzle-orm'
import { templateConfig } from '../../../server/template-config.ts'
import { accountSiteOf } from '../../site/site.ts'

export interface StepUpProjectContext {
  readonly db: Database
  /** 当前请求（server function 的请求） */
  readonly request: Request
}

export interface StepUpEmailBrand {
  readonly appName: string
  readonly appUrl: string
}

export async function stepUpVerificationColumns(
  userId: string,
  { db }: StepUpProjectContext,
): Promise<Record<string, unknown>> {
  const [row] = await db.select({ site: user.site }).from(user).where(eq(user.id, userId))
  // 找不到用户时不追加：模板随后按「无可用方式」拒绝，不会写入 verification
  return row ? { site: row.site } : {}
}

export function stepUpEmailBrand(
  defaults: StepUpEmailBrand,
  { request }: StepUpProjectContext,
): StepUpEmailBrand {
  return {
    ...defaults,
    appName: siteBrandName(templateConfig, accountSiteOf(request, templateConfig)),
  }
}

/**
 * 邮件消费者按收件人语言渲染品牌名（项目的 createQueueAuthEmailSender 以函数接收 appName）：
 * 本站有该语言的品牌名时用它，否则用 stepUpEmailBrand 给出的名称。
 */
export function stepUpBrandName(brand: StepUpEmailBrand, site: SiteId, locale: string | null) {
  return locale ? siteBrandName(templateConfig, site, locale) : brand.appName
}
