/**
 * 结果分享链接（openspec add-dual-site-foundation 决策 5，specs/tool-pages「可分享结果链接」）：
 * 结果的输入编码为 base64url JSON，放在 `#r=` 片段中。片段不发往服务器，天然不被索引；
 * 键名像姓名、邮箱、电话的字段在编码前丢弃，分享链接不含可识别个人身份的明文。
 */
export const SHARE_PARAM = 'r'

export type ShareValue = string | number | boolean | null
export type ShareInput = Readonly<Record<string, ShareValue>>

const PERSONAL_KEY = /name|mail|phone|tel/i

/** 去掉个人信息字段与非标量值 */
export function shareableInput(input: Readonly<Record<string, unknown>>): ShareInput {
  const result: Record<string, ShareValue> = {}
  for (const [key, value] of Object.entries(input)) {
    if (PERSONAL_KEY.test(key)) continue
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value))
      result[key] = value as ShareValue
  }
  return result
}

function toBase64Url(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  )
}

export function encodeShareInput(input: Readonly<Record<string, unknown>>): string {
  return toBase64Url(JSON.stringify(shareableInput(input)))
}

/** 解码失败或内容不是对象时返回 null（链接被截断或篡改） */
export function decodeShareInput(value: string): ShareInput | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return shareableInput(parsed as Record<string, unknown>)
  } catch {
    return null
  }
}

/** 工具页地址 + `#r=` 片段；`pageUrl` 中已有的查询串与片段会被去掉 */
export function shareUrl(pageUrl: string, input: Readonly<Record<string, unknown>>): string {
  const url = new URL(pageUrl)
  url.search = ''
  url.hash = `${SHARE_PARAM}=${encodeShareInput(input)}`
  return url.href
}

/** 读取 `location.hash`（`#r=...`）中的分享输入 */
export function readShareFragment(hash: string): ShareInput | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(SHARE_PARAM)
  return value ? decodeShareInput(value) : null
}
