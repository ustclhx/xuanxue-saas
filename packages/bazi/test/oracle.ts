/**
 * 双源校验：把引擎（基于 tyme4ts）与 lunar-javascript 的结果规整成同一结构再比较。
 * 时间换算（时区/夏令时/真太阳时）是引擎自己的规则，两边共用 resolveBirthTime 的结果。
 */
import { LunarUtil, Solar } from 'lunar-javascript'
import type { BaziChart } from '../src/chart.ts'
import type { BirthInput } from '../src/input.ts'
import { type DateTimeParts, resolveBirthTime } from '../src/time.ts'

const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui']
const BRANCH_KEYS = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
]
const TEN_GOD_HANZI: Record<string, string> = {
  biJian: '比肩',
  jieCai: '劫财',
  shiShen: '食神',
  shangGuan: '伤官',
  pianCai: '偏财',
  zhengCai: '正财',
  qiSha: '七杀',
  zhengGuan: '正官',
  pianYin: '偏印',
  zhengYin: '正印',
}

const stemHanzi = (key: string) => STEM_HANZI[STEM_KEYS.indexOf(key)] as string
const branchHanzi = (key: string) => BRANCH_HANZI[BRANCH_KEYS.indexOf(key)] as string

export type DualRecord = {
  usedTime: string
  pillars: (string | null)[]
  lunar: string
  hiddenStems: (string[] | null)[]
  stemTenGods: (string | null)[]
  hiddenTenGods: (string[] | null)[]
  kongWang: { day: string; year: string }
  fortune: {
    forward: boolean
    /** 起运只比到「年 + 月」：两库对节气间隔不足一分钟的部分取整不同（流派 2 中 1 分钟 = 2 小时）。 */
    startAfter: string
    decades: string[]
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (p: DateTimeParts, withTime: boolean) =>
  `${p.year}-${pad(p.month)}-${pad(p.day)}${withTime ? ` ${pad(p.hour)}:${pad(p.minute)}` : ''}`

function decadeLine(ganzhi: string, startYear: number, endYear: number, a: number, b: number) {
  return `${ganzhi} ${startYear}-${endYear} ${a}-${b}岁`
}

/** 引擎输出 → 规整结构。 */
export function engineRecord(chart: BaziChart): DualRecord {
  const p = chart.pillars
  const list = [p.year, p.month, p.day, p.hour]
  const kong = (basis: string) => {
    const entry = chart.shensha.find((s) => s.key === 'kongWang' && s.basis === basis)
    return (entry?.targets ?? []).map(branchHanzi).join('')
  }
  const l = chart.time.lunar
  const f = chart.fortune
  return {
    usedTime: fmt(chart.time.used, chart.hourKnown),
    pillars: list.map((x) => (x ? stemHanzi(x.stem) + branchHanzi(x.branch) : null)),
    lunar: `${l.year}-${l.isLeapMonth ? '闰' : ''}${l.month}-${l.day}`,
    hiddenStems: list.map((x) => (x ? x.hiddenStems.map((h) => stemHanzi(h.stem)) : null)),
    stemTenGods: list.map((x, i) =>
      x === null ? null : i === 2 ? '日主' : (TEN_GOD_HANZI[x.tenGod ?? ''] as string),
    ),
    hiddenTenGods: list.map((x) =>
      x ? x.hiddenStems.map((h) => TEN_GOD_HANZI[h.tenGod] as string) : null,
    ),
    kongWang: { day: kong('dayPillar'), year: kong('yearPillar') },
    fortune: {
      forward: f.forward,
      startAfter: `${f.startAfter.years}年${f.startAfter.months}月`,
      decades: f.decades.map((d) =>
        decadeLine(
          stemHanzi(d.stem) + branchHanzi(d.branch),
          d.startYear,
          d.endYear,
          d.startAge,
          d.endAge,
        ),
      ),
    },
  }
}

/** lunar-javascript 独立计算 → 规整结构。 */
export function lunarRecord(input: BirthInput): DualRecord {
  const time = resolveBirthTime(input)
  const hourKnown = input.time !== null
  const b = time.beijing
  const u = time.used
  const instant = Solar.fromYmdHms(b.year, b.month, b.day, b.hour, b.minute, b.second)
  const instantEc = instant.getLunar().getEightChar()
  const local = Solar.fromYmdHms(u.year, u.month, u.day, hourKnown ? u.hour : 12, u.minute, 0)
  const localEc = local.getLunar().getEightChar()
  // 流派 1：晚子时（23 点后）日柱算次日，与引擎「23 点换日」一致
  localEc.setSect(1)
  const lunarDay = (hourKnown && u.hour >= 23 ? local.next(1) : local).getLunar()
  const month = lunarDay.getMonth()
  const yun = instantEc.getYun(input.gender === 'male' ? 1 : 0, 2)
  const hidden = [
    instantEc.getYearHideGan(),
    instantEc.getMonthHideGan(),
    localEc.getDayHideGan(),
    hourKnown ? localEc.getTimeHideGan() : null,
  ]
  return {
    usedTime: fmt(u, hourKnown),
    pillars: [
      instantEc.getYear(),
      instantEc.getMonth(),
      localEc.getDay(),
      hourKnown ? localEc.getTime() : null,
    ],
    lunar: `${lunarDay.getYear()}-${month < 0 ? '闰' : ''}${Math.abs(month)}-${lunarDay.getDay()}`,
    hiddenStems: hidden,
    // 年、月柱十神需以「本地日干」为准；lunar 的 EightChar 以自身日干计算，故用本地八字的年月十神
    stemTenGods: [
      tenGodByLunar(localEc, instantEc.getYearGan()),
      tenGodByLunar(localEc, instantEc.getMonthGan()),
      '日主',
      hourKnown ? localEc.getTimeShiShenGan() : null,
    ],
    hiddenTenGods: hidden.map((list) =>
      list === null ? null : list.map((g: string) => tenGodByLunar(localEc, g)),
    ),
    kongWang: { day: localEc.getDayXunKong(), year: instantEc.getYearXunKong() },
    fortune: {
      forward: yun.isForward(),
      startAfter: `${yun.getStartYear()}年${yun.getStartMonth()}月`,
      decades: yun
        .getDaYun(11)
        .slice(1)
        // biome-ignore lint/suspicious/noExplicitAny: lunar-javascript 无类型
        .map((d: any) =>
          decadeLine(
            d.getGanZhi(),
            d.getStartYear(),
            d.getEndYear(),
            d.getStartAge(),
            d.getEndAge(),
          ),
        ),
    },
  }
}

/** lunar-javascript 的十神表，键为「日干 + 目标干」。 */
// biome-ignore lint/suspicious/noExplicitAny: lunar-javascript 无类型
function tenGodByLunar(localEc: any, gan: string): string {
  return LunarUtil.SHI_SHEN[localEc.getDayGan() + gan] as string
}
