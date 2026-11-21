import { defineTemplateConfig, SITE_IDS } from '@xuanxue/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { gateSiteRequest, notFoundPath, routeSite } from '../site/gate.ts'
import { type SitesConfig, siteHasLocale, siteOfLocale } from '../site/site.ts'
import { authLocaleRedirect } from './auth-locale.ts'
import {
  isLocaleLive,
  isLocaleReleased,
  isProductionHost,
  LOCALE_RELEASE,
  type ReleaseTable,
  releasedSiteLocales,
  releaseState,
} from './rollout.ts'
import { BEFORE_JA_ES_EAST_EN, overrideRelease } from './rollout-fixture.ts'
import { hasForeignPrefix, siteLocale } from './site-locale.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'
const PREVIEW = 'https://xuanxue-web-staging.example.workers.dev'

// 第一期的目标形态：ja 归东方站、es 归西方站。2026-11-21 二者已发布；发布机制（pending 不可访问、不可发现）
// 的用例用发布前的状态（PENDING / BEFORE_JA_ES_EAST_EN）验证，现状另有用例
const config = defineTemplateConfig({
  app: { name: 'xuanxue', url: WEST, supportEmail: 'support@arcanumber.com' },
  i18n: { locales: ['en', 'zh-Hant', 'zh-Hans', 'ko', 'ja', 'es'], defaultLocale: 'en' },
  sites: {
    east: {
      hosts: ['ganjiday.com'],
      locales: ['zh-Hant', 'zh-Hans', 'ko', 'ja'],
      defaultLocale: null,
    },
    west: { hosts: ['arcanumber.com'], locales: ['en', 'es'], defaultLocale: 'en' },
  },
})

/**
 * 按站点登记语言（使用者 2026-11-20：东方站补完整英文页面）：`en` 同时属于两站。
 * 模板的 defineTemplateConfig 目前拒绝一种语言属于两个站点（模板需求 TR-1），这里直接构造站点配置验证项目侧的模型。
 */
const perSite: SitesConfig = {
  ...config,
  sites: {
    ...config.sites,
    east: { ...config.sites.east, locales: ['zh-Hant', 'zh-Hans', 'ko', 'ja', 'en'] },
  },
}

/** 发布前的发布表：ja、东方站 en 与西方站 es 为 pending */
const PENDING: ReleaseTable = {
  east: { ...LOCALE_RELEASE.east, ...BEFORE_JA_ES_EAST_EN.east },
  west: { ...LOCALE_RELEASE.west, ...BEFORE_JA_ES_EAST_EN.west },
}

/** 部分函数（hasForeignPrefix、siteNavLocale 等）读取全局发布表：这些用例期间把全局表改回发布前 */
function usePendingRelease() {
  let restore = () => {}
  beforeEach(() => {
    restore = overrideRelease(BEFORE_JA_ES_EAST_EN)
  })
  afterEach(() => restore())
}

const route = (url: string, sites: SitesConfig = config, table?: ReleaseTable | null) =>
  routeSite(new URL(url), sites, table === undefined ? LOCALE_RELEASE : table)
const pass = (noindex = false) => ({ kind: 'pass', noindex })
const notFound = { kind: 'not-found' }

describe('发布状态登记（rollout.ts）', () => {
  it('当前配置的每个站点语言都已登记；2026-11-21 起 ja、es 与东方站 en 为 released', () => {
    for (const site of SITE_IDS)
      for (const locale of templateConfig.sites[site].locales)
        expect(LOCALE_RELEASE[site][locale], `${site}:${locale}`).toBeDefined()
    expect(releasedSiteLocales('east', templateConfig)).toEqual([
      'zh-Hant',
      'zh-Hans',
      'ko',
      'ja',
      'en',
    ])
    expect(releasedSiteLocales('west', templateConfig)).toEqual(['en', 'es'])
  })

  it('东方站 en 与西方站 en 分别登记；未登记的组合按 pending 处理', () => {
    expect(releaseState('east', 'ja')).toBe('released')
    expect(releaseState('west', 'es')).toBe('released')
    expect(releaseState('west', 'en')).toBe('released')
    expect(releaseState('east', 'en')).toBe('released')
    expect(releaseState('east', 'en', PENDING)).toBe('pending')
    expect(releaseState('west', 'en', PENDING)).toBe('released')
    // 未登记的组合按 pending 处理，不会意外上线
    expect(releaseState('east', 'es')).toBe('pending')
    expect(releaseState('west', 'ja')).toBe('pending')
  })

  it('正式域名只认注册表中的 host', () => {
    expect(isProductionHost('ganjiday.com', config)).toBe(true)
    expect(isProductionHost('ARCANUMBER.COM:443', config)).toBe(true)
    expect(isProductionHost('east.localhost:3000', config)).toBe(false)
    expect(isProductionHost('xuanxue-web-staging.example.workers.dev', config)).toBe(false)
  })

  it('isLocaleLive：正式域名只开放已发布语言，staging、预览与本地主机全部开放', () => {
    expect(isLocaleLive('ja', 'ganjiday.com', config, PENDING)).toBe(false)
    expect(isLocaleLive('zh-Hant', 'ganjiday.com', config, PENDING)).toBe(true)
    expect(isLocaleLive('es', 'arcanumber.com', config, PENDING)).toBe(false)
    expect(isLocaleLive('en', 'arcanumber.com', config, PENDING)).toBe(true)
    expect(isLocaleLive('ja', 'east.localhost:3000', config, PENDING)).toBe(true)
    expect(isLocaleLive('es', 'xuanxue-web-staging.example.workers.dev', config, PENDING)).toBe(
      true,
    )
    // 同一语言按主机所在站点判断
    expect(isLocaleLive('en', 'ganjiday.com', perSite, PENDING)).toBe(false)
    expect(isLocaleLive('en', 'arcanumber.com', perSite, PENDING)).toBe(true)
    // 现状：已发布后正式域名开放
    expect(isLocaleLive('ja', 'ganjiday.com', config)).toBe(true)
    expect(isLocaleLive('es', 'arcanumber.com', config)).toBe(true)
    expect(isLocaleLive('en', 'ganjiday.com', perSite)).toBe(true)
    // 未登记的组合仍关闭
    expect(isLocaleLive('es', 'ganjiday.com', config)).toBe(false)
  })

  it('可发现位置只用已发布语言，不看主机', () => {
    expect(releasedSiteLocales('east', config, PENDING)).toEqual(['zh-Hant', 'zh-Hans', 'ko'])
    expect(releasedSiteLocales('west', config, PENDING)).toEqual(['en'])
    expect(releasedSiteLocales('east', perSite, PENDING)).toEqual(['zh-Hant', 'zh-Hans', 'ko'])
    expect(isLocaleReleased('ja', config, undefined, PENDING)).toBe(false)
    expect(isLocaleReleased('en', perSite, undefined, PENDING)).toBe(true)
    expect(isLocaleReleased('en', perSite, 'east', PENDING)).toBe(false)
    expect(isLocaleReleased('en', perSite, 'west', PENDING)).toBe(true)
    const released: ReleaseTable = {
      ...PENDING,
      east: { ...PENDING.east, ja: 'released' },
    }
    expect(releasedSiteLocales('east', config, released)).toEqual([
      'zh-Hant',
      'zh-Hans',
      'ko',
      'ja',
    ])
  })
})

describe('站点守卫按发布状态拦截', () => {
  usePendingRelease()

  it('正式域名上的未发布语言前缀返回 404，不跨站跳转', () => {
    expect(route(`${EAST}/ja`)).toEqual(notFound)
    expect(route(`${EAST}/ja/pricing`)).toEqual(notFound)
    expect(route(`${WEST}/es`)).toEqual(notFound)
    expect(route(`${WEST}/es/tarot`)).toEqual(notFound)
    // 另一站点的未发布语言：与外站语言相同返回 404
    expect(route(`${WEST}/ja`)).toEqual(notFound)
    expect(route(`${EAST}/es`)).toEqual(notFound)
  })

  it('staging、预览与本地主机放行未发布语言（预览整体 noindex）', () => {
    expect(route(`${PREVIEW}/es/tarot`)).toEqual(pass(true))
    expect(route(`${PREVIEW}/ja`)).toEqual(pass(true))
    expect(route('http://east.localhost:3000/ja')).toEqual(pass())
    expect(route('http://west.localhost:3000/es')).toEqual(pass())
  })

  it('发布后正式域名放行；已发布语言不受影响', () => {
    const released: ReleaseTable = {
      ...LOCALE_RELEASE,
      east: { ...LOCALE_RELEASE.east, ja: 'released' },
    }
    expect(route(`${EAST}/ja`, config, released)).toEqual(pass())
    expect(route(`${EAST}/zh-hant/pricing`)).toEqual(pass())
    expect(route(`${EAST}/ko`)).toEqual(pass())
    expect(route(`${WEST}/pricing`)).toEqual(pass())
  })

  it('构建期预渲染请求不按发布状态拦截（pending 页面照常预渲染供 staging 使用）', async () => {
    expect(route(`${EAST}/ja`, config, null)).toEqual(pass())
    const seen: string[] = []
    const response = await gateSiteRequest(
      new Request(`${EAST}/ja`),
      config,
      (request) => {
        seen.push(new URL(request.url).pathname)
        return new Response('ok')
      },
      { canonicalize: false, prerender: true },
    )
    expect(await response.text()).toBe('ok')
    expect(seen).toEqual(['/ja'])
  })

  it('正式域名的未发布语言 404 页用本站导航语言渲染', async () => {
    expect(notFoundPath(new URL(`${EAST}/ja/pricing`), config)).toMatch(/^\/zh-hant\//)
    expect(notFoundPath(new URL(`${WEST}/es/tarot`), config)).not.toMatch(/^\/es\//)
    expect(notFoundPath(new URL('http://east.localhost:3000/ja/x'), config)).toMatch(/^\/ja\//)
    const seen: string[] = []
    await gateSiteRequest(new Request(`${EAST}/ja`), config, (request) => {
      seen.push(new URL(request.url).pathname)
      return new Response('404', { status: 404 })
    })
    expect(seen[0]).toMatch(/^\/zh-hant\//)
  })

  it('客户端与服务端一致：正式域名上的未发布语言前缀按外站前缀处理', () => {
    expect(hasForeignPrefix(new URL(`${EAST}/ja`), config, true)).toBe(true)
    expect(hasForeignPrefix(new URL('http://east.localhost:3000/ja'), config, true)).toBe(false)
    expect(siteLocale('ja', new URL(`${EAST}/ja`), config, true)).toBe('zh-Hant')
    expect(siteLocale('ja', new URL(`${PREVIEW}/ja`), config, true)).toBe('ja')
    // 服务端（构建期预渲染以正式域名为 Host）不按发布状态判断：pending 页面照常去掉前缀渲染
    expect(hasForeignPrefix(new URL(`${EAST}/ja`), config, false)).toBe(false)
    expect(siteLocale('ja', new URL(`${EAST}/ja`), config, false)).toBe('ja')
    // 默认值：测试运行在 Node（无 document），与服务端一致
    expect(hasForeignPrefix(new URL(`${EAST}/ja`), config)).toBe(false)
  })
})

describe('跳转目标只用已发布语言', () => {
  usePendingRelease()

  it('认证页：西语浏览器在 es 未发布时不跳到 /es/login', () => {
    const request = new Request(`${WEST}/login`, {
      headers: { 'accept-language': 'es-MX,es;q=0.9' },
    })
    expect(authLocaleRedirect(request, config)).toBeNull()
  })
})

describe('同一语言按站点登记（东方站 /en/…）', () => {
  usePendingRelease()

  it('只知道语言时 en 归以它为默认语言的西方站', () => {
    expect(siteOfLocale('en', perSite)).toBe('west')
    expect(siteHasLocale('east', 'en', perSite)).toBe(true)
    expect(siteHasLocale('west', 'en', perSite)).toBe(true)
  })

  it('东方站 en 未发布：旧地址 /en 301 到英文首页 /，其他 /en/* 一律 404；根路径英文页面在正式域名维持原跳转', () => {
    expect(route(`${EAST}/en`, perSite)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/`,
    })
    // 东方站英文在根路径（5b），`/en/*` 不是任何页面
    expect(route(`${EAST}/en/tarot`, perSite)).toEqual(notFound)
    expect(route('http://east.localhost:3000/en/tarot', perSite)).toEqual(notFound)
    // 认证页仍 302 到无前缀地址
    expect(route(`${EAST}/en/login`, perSite)).toEqual({
      kind: 'redirect',
      status: 302,
      location: `${EAST}/login`,
    })
    // 正式域名上未发布：与发布前相同，301 到繁中同路径；预览主机放行
    expect(route(`${EAST}/tarot-spreads`, perSite)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/tarot-spreads`,
    })
    expect(route(`${EAST}/faq`, perSite)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/faq`,
    })
    expect(route('http://east.localhost:3000/tarot-spreads', perSite)).toEqual(pass())
    // 只属于东方站英文的地址在西方站 404，不跨站
    expect(route(`${WEST}/bazi-calculator`, perSite)).toEqual(notFound)
    expect(route(`${WEST}/tarot-feelings/the-sun`, perSite)).toEqual(notFound)
    expect(route(`${WEST}/faq`, perSite)).toEqual(pass())
    // 西方站的 en 不受东方站状态影响：默认语言前缀仍 301 到无前缀地址
    expect(route(`${WEST}/en/pricing`, perSite)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${WEST}/pricing`,
    })
  })

  it('东方站 en 发布后根路径英文页面在东方站放行；/en/* 仍 404', () => {
    const released: ReleaseTable = {
      ...LOCALE_RELEASE,
      east: { ...LOCALE_RELEASE.east, en: 'released' },
    }
    expect(route(`${EAST}/tarot-spreads/one-card`, perSite, released)).toEqual(pass())
    expect(route(`${EAST}/pricing`, perSite, released)).toEqual(pass())
    expect(route(`${EAST}/en/tarot`, perSite, released)).toEqual(notFound)
    // 发布后 `/en/<英文页面>` 与西方站一样 301 到无前缀地址（ML-01）
    expect(route(`${EAST}/en/pricing`, perSite, released)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/pricing`,
    })
    // 不是东方站英文页面的无前缀地址维持原跳转
    expect(route(`${EAST}/tarot`, perSite, released)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/tarot`,
    })
  })

  it('发布前（en 只属于西方站）：东方站 /en 301 到 /（预渲染照常生成），/en/* 返回 404', () => {
    expect(route(`${EAST}/en`)).toEqual({ kind: 'redirect', status: 301, location: `${EAST}/` })
    expect(route(`${EAST}/en`, config, null)).toEqual(pass())
    expect(route(`${EAST}/en/pricing`)).toEqual(notFound)
  })
})

describe('现状：2026-11-21 发布 ja、es 与东方站根路径英文', () => {
  const live = (url: string) => routeSite(new URL(url), templateConfig)

  it('正式域名放行 ja 与 es 前缀，西方站不放行东方站语言，东方站不放行 es', () => {
    expect(live(`${EAST}/ja`)).toEqual(pass())
    expect(live(`${EAST}/ja/pricing`)).toEqual(pass())
    expect(live(`${WEST}/es`)).toEqual(pass())
    expect(live(`${WEST}/es/pricing`)).toEqual(pass())
    expect(live(`${WEST}/ja`)).toEqual(notFound)
    expect(live(`${EAST}/es`)).toEqual(notFound)
  })

  it('东方站根路径英文页面放行；/en 与 /en/<英文页面> 301 到无前缀地址，其余 /en/* 404', () => {
    for (const path of [
      '/bazi-calculator',
      '/zi-wei-dou-shu',
      '/tarot-spreads',
      '/faq',
      '/pricing',
    ])
      expect(live(`${EAST}${path}`), path).toEqual(pass())
    expect(live(`${EAST}/en`)).toEqual({ kind: 'redirect', status: 301, location: `${EAST}/` })
    expect(live(`${EAST}/en/bazi-calculator`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/bazi-calculator`,
    })
    expect(live(`${EAST}/en/tarot`)).toEqual(notFound)
    // 只属于东方站英文的地址在西方站仍 404，不跨站
    expect(live(`${WEST}/bazi-calculator`)).toEqual(notFound)
  })

  it('不是东方站英文页面的无前缀地址仍 301 到繁中同路径（不跳到不存在的 /en/…）', () => {
    expect(live(`${EAST}/tarot`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/tarot`,
    })
    expect(live(`${EAST}/blog?x=1`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/blog?x=1`,
    })
  })
})
