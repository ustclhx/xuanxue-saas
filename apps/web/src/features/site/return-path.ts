import { localeUrlSegment } from '@xuanxue/config'
import { EAST_UNPREFIXED_PREFIXES } from './gate.ts'

/**
 * 登录与支付完成后回到发起页面（specs/multi-site「账号与付费跨站可用」，决策 4）。
 * 只接受本站的相对路径：字符集限定后不会形成协议相对地址、反斜杠或其他 Host；
 * 片段不在其中（结果输入放在 `#r=`，不发给服务端与支付服务商）。
 * 认证页、接口与内部路径不作为回跳目标，避免循环与触发接口副作用。
 * 纯函数，浏览器与服务端都可使用。
 */
const RETURN_PATH = /^\/(?![/\\])[\w\-.~%/]*(?:\?[\w\-.~%&=+]*)?$/
const MAX_LENGTH = 1024
const EXCLUDED_PREFIXES = ['/api', ...EAST_UNPREFIXED_PREFIXES]

export function safeReturnPath(
  value: string | null | undefined,
  locales: readonly string[],
): string | undefined {
  if (!value || value.length > MAX_LENGTH || !RETURN_PATH.test(value)) return undefined
  const [pathname = '/'] = value.split('?')
  const [, first = ''] = pathname.split('/')
  if (first.startsWith('_')) return undefined
  // 带语言前缀的认证页（`/ko/login`）与无前缀的同样排除
  const locale = locales.find((item) => localeUrlSegment(item) === first)
  const rest = locale ? pathname.slice(first.length + 1) || '/' : pathname
  if (EXCLUDED_PREFIXES.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`)))
    return undefined
  return value
}
