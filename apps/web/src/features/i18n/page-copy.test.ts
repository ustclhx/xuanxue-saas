import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { staticPage } from '../seo/metadata.ts'
import { numerologyTool } from '../tools/numerology/routes.ts'
import { tarotDescription, tarotSeoTitle, tarotTitle } from '../tools/tarot/routes.ts'
import { pageCopy } from './page-copy.ts'
import { STRICT_MESSAGE_LOCALES } from './rollout.ts'

// 单元测试的 setup 与服务端一样静态登记页面文案（vitest.config.ts setupFiles）
describe('按语言拆分的页面 SEO 文案（add-locales-eu-ja 决策 11）', () => {
  it('配置中的新语言都提供拆分文案，并已在服务端登记', () => {
    const fresh = templateConfig.i18n.locales.filter((locale) =>
      STRICT_MESSAGE_LOCALES.includes(locale),
    )
    for (const locale of fresh) {
      expect(pageCopy(locale), locale).toBeDefined()
    }
  })

  it('静态页、塔罗与数字命理的 head 取拆分文案；导航名保持短名', () => {
    expect(staticPage('/', 'es').title).toBe('Arcanumber: numerología y tarot gratis, paso a paso')
    expect(staticPage('/pricing', 'es').title).toBe('Precios: herramientas gratis y créditos')
    expect(tarotSeoTitle('yes-or-no', 'es')).toBe('Tarot sí o no gratis con 1 carta')
    expect(tarotTitle('yes-or-no', 'es')).toBe('Tarot sí o no')
    expect(tarotDescription('daily', 'es')).toMatch(/^Tarot del día gratis/)
    expect(numerologyTool('numerology-calculator', 'es').title).toBe(
      'Calculadora de numerología gratis y completa',
    )
    // v1 语言不经拆分文案，输出与改动前相同
    expect(tarotSeoTitle('yes-or-no', 'en')).toBe('Yes or No Tarot')
    expect(staticPage('/pricing', 'en').title).toBe('Pricing: free tools and credit packs')
  })
})
