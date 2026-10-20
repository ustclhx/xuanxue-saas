import { describe, expect, it } from 'vitest'
import { decodeShareInput, encodeShareInput, readShareFragment, shareUrl } from './share.ts'

const input = { calendar: 'solar', year: 1990, month: 5, day: 15, time: '10:30', place: '台北' }

describe('分享链接', () => {
  it('base64url 往返，含中文', () => {
    const encoded = encodeShareInput(input)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeShareInput(encoded)).toEqual(input)
  })

  it('结果放在 #r= 片段，去掉原有查询串', () => {
    const url = new URL(shareUrl('https://ganjiday.com/zh-hant/x/?r=old#top', input))
    expect(url.search).toBe('')
    expect(url.pathname).toBe('/zh-hant/x/')
    expect(readShareFragment(url.hash)).toEqual(input)
  })

  it('姓名、邮箱、电话等字段不进入链接，链接中也没有其明文', () => {
    const href = shareUrl('https://arcanumber.com/life-path/', {
      ...input,
      name: 'Alice Wang',
      fullName: 'Alice',
      email: 'alice@example.com',
      phone: '0912',
    })
    const decoded = readShareFragment(new URL(href).hash)
    expect(decoded).toEqual(input)
    expect(atob(new URL(href).hash.slice(3).replaceAll('-', '+').replaceAll('_', '/'))).not.toMatch(
      /Alice|example\.com/,
    )
  })

  it('截断或篡改的链接返回 null', () => {
    expect(decodeShareInput('%%%')).toBeNull()
    expect(decodeShareInput(encodeShareInput(input).slice(0, 5))).toBeNull()
    expect(decodeShareInput(btoa('[1,2]'))).toBeNull()
    expect(readShareFragment('')).toBeNull()
  })
})
