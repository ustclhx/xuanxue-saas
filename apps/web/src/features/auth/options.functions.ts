import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { requireFreshSession } from '@xuanxue/auth'
import { AppError } from '@xuanxue/shared'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { authUiOptions } from './options.ts'

/** 认证页面的 loader：在服务端读取模板配置与 env，只返回公开的部分 */
export const getAuthUiOptions = createServerFn({ method: 'GET' }).handler(() =>
  authUiOptions(templateConfig, getWebRuntime().config),
)

/** 结果页只读数据库中的验证状态，不能以缺少 error 参数作为验证成功的证据。 */
export const getEmailVerificationState = createServerFn({ method: 'GET' }).handler(async () => {
  const { auth, db } = getWebRuntime()
  try {
    const { user } = await requireFreshSession({ auth, db, headers: getRequest().headers })
    return { verified: user.emailVerified }
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 403))
      return { verified: false }
    throw error
  }
})
