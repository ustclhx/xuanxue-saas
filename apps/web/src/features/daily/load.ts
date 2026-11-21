import { type CivilDate, dateKey } from './date.ts'
import { type EastDayFacts, eastDayFacts, type WestDayFacts, westDayFacts } from './facts.ts'

// 每日页的路由 loader 与数据类型。路由文件的 loader 不参与组件拆分、随路由树进入全站静态闭包；
// loader 放在页面组件文件里会把整页组件与其文案一起带进每个首页的脚本（首页包预算，add-locales-eu-ja 决策 11），
// 因此独立成不含组件的小模块，页面组件随路由 component 按需加载。

/** 流日引擎按需加载：tyme4ts 较大，不进首屏包（design D8） */
export const loadDailyEngine = () => import('@xuanxue/bazi/daily')

export interface EastDailyData {
  /** 参考日期（`YYYY-MM-DD`） */
  readonly date: string
  readonly facts: EastDayFacts
}

/** 页面 loader：只由日期与规则表计算，不访问数据库与会话（daily-horoscope spec「公开页不查库且可缓存」） */
export async function loadEastDaily(date: CivilDate): Promise<EastDailyData> {
  const engine = await loadDailyEngine()
  return { date: dateKey(date), facts: eastDayFacts(engine, date) }
}

export interface WestDailyData {
  readonly date: string
  readonly facts: WestDayFacts
}

/** 页面 loader：只由日期计算，不访问数据库与会话 */
export function loadWestDaily(date: CivilDate): WestDailyData {
  return { date: dateKey(date), facts: westDayFacts(date) }
}
