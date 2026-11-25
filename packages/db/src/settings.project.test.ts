// 项目自有设置（settings.project.ts）：不 mock 项目文件，按真实登记读取默认值与校验。
import { describe, expect, it } from 'vitest'
import {
  getSetting,
  getSettingDefinition,
  type SettingCache,
  type SettingStore,
  settingDefaults,
  validateSettingValue,
} from './settings.ts'

function memoryStore(rows: Readonly<Record<string, unknown>>): SettingStore {
  return {
    async find(key) {
      return rows[key]
    },
  }
}

function memoryCache(): SettingCache {
  const data = new Map<string, string>()
  return {
    async get(key) {
      return data.get(key) ?? null
    },
    async put(key, value) {
      data.set(key, value)
    },
  }
}

function accepts(key: 'operations.webhookUrl' | 'operations.webhookSecret', value: string) {
  try {
    validateSettingValue(key, value)
    return true
  } catch {
    return false
  }
}

describe('详批运行时设置', () => {
  it('每种详批默认启用、10 积分、尚未选定模型', () => {
    expect(settingDefaults['readings.bazi-full.enabled']).toBe(true)
    expect(settingDefaults['readings.saju-full.credits']).toBe(10)
    expect(settingDefaults['readings.tarot-spread.modelKey']).toBe('')
    expect(settingDefaults['readings.ziwei-full.promptVersion']).toBe('')
  })

  it('natal-full 不写设置行时取代码默认值：开启（使用者 2026-11-24 审阅样例后开放）', async () => {
    const store = memoryStore({})
    const cache = memoryCache()
    expect(await getSetting({ store, cache }, 'readings.natal-full.enabled')).toBe(true)
    // 缓存里的「表中缺失」同样回退到默认值
    expect(await getSetting({ store, cache }, 'readings.natal-full.enabled')).toBe(true)
  })

  it('后台已写入的值按定义读取，非法积分拒绝写入', async () => {
    const store = memoryStore({
      'readings.bazi-full.credits': 25,
      'readings.bazi-full.modelKey': 'deepseek-flash',
    })
    expect(await getSetting({ store }, 'readings.bazi-full.credits')).toBe(25)
    expect(await getSetting({ store }, 'readings.bazi-full.modelKey')).toBe('deepseek-flash')
    expect(() => validateSettingValue('readings.bazi-full.credits', -1)).toThrow()
    expect(() => validateSettingValue('readings.bazi-full.credits', 1.5)).toThrow()
  })
})

describe('通用运营 webhook', () => {
  it('地址与密钥标记为密钥项，默认未配置', () => {
    expect(getSettingDefinition('operations.webhookUrl')?.secret).toBe(true)
    expect(getSettingDefinition('operations.webhookSecret')?.secret).toBe(true)
    expect(settingDefaults['operations.webhookUrl']).toBe('')
  })

  it('只接受公网 HTTPS 域名的默认端口，空字符串表示清除', () => {
    expect(accepts('operations.webhookUrl', '')).toBe(true)
    expect(accepts('operations.webhookUrl', 'https://hooks.example.com/routine?x=1')).toBe(true)
    for (const value of [
      'http://hooks.example.com/routine',
      'https://hooks.example.com:8443/routine',
      'https://user:pass@hooks.example.com/routine',
      'https://hooks.example.com/routine#frag',
      'https://127.0.0.1/routine',
      'https://router.lan/routine',
      'https://localhost/routine',
    ])
      expect(accepts('operations.webhookUrl', value), value).toBe(false)
  })

  it('密钥只接受 8–512 个可见 ASCII', () => {
    expect(accepts('operations.webhookSecret', 'abcdefgh')).toBe(true)
    expect(accepts('operations.webhookSecret', 'short')).toBe(false)
    expect(accepts('operations.webhookSecret', 'has space inside')).toBe(false)
  })
})
