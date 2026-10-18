import type {
  CityId,
  Element,
  InputIssue,
  PillarKey,
  ShenshaBasis,
  ShenshaKey,
  TenGod,
} from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'

/**
 * 引擎结果只含稳定 key（决策 2），这里把 key 映射到 messages/<locale>/bazi.json 的文案函数。
 * 显式列出每个函数而不是按字符串拼键名，便于类型检查与按需打包。
 */
type Message = () => string

export const ELEMENT_LABEL: Record<Element, Message> = {
  wood: m.bazi_element_wood,
  fire: m.bazi_element_fire,
  earth: m.bazi_element_earth,
  metal: m.bazi_element_metal,
  water: m.bazi_element_water,
}

export const TEN_GOD_LABEL: Record<TenGod, Message> = {
  biJian: m.bazi_tengod_bi_jian,
  jieCai: m.bazi_tengod_jie_cai,
  shiShen: m.bazi_tengod_shi_shen,
  shangGuan: m.bazi_tengod_shang_guan,
  pianCai: m.bazi_tengod_pian_cai,
  zhengCai: m.bazi_tengod_zheng_cai,
  qiSha: m.bazi_tengod_qi_sha,
  zhengGuan: m.bazi_tengod_zheng_guan,
  pianYin: m.bazi_tengod_pian_yin,
  zhengYin: m.bazi_tengod_zheng_yin,
}

export const PILLAR_LABEL: Record<PillarKey, Message> = {
  year: m.bazi_pillar_year,
  month: m.bazi_pillar_month,
  day: m.bazi_pillar_day,
  hour: m.bazi_pillar_hour,
}

export const SHENSHA_LABEL: Record<ShenshaKey, Message> = {
  kongWang: m.bazi_shensha_kong_wang,
  taoHua: m.bazi_shensha_tao_hua,
  tianYiGuiRen: m.bazi_shensha_tian_yi_gui_ren,
  yiMa: m.bazi_shensha_yi_ma,
  huaGai: m.bazi_shensha_hua_gai,
  wenChang: m.bazi_shensha_wen_chang,
  yangRen: m.bazi_shensha_yang_ren,
  luShen: m.bazi_shensha_lu_shen,
}

export const BASIS_LABEL: Record<ShenshaBasis, Message> = {
  dayPillar: m.bazi_basis_day_pillar,
  yearPillar: m.bazi_basis_year_pillar,
  dayStem: m.bazi_basis_day_stem,
  yearStem: m.bazi_basis_year_stem,
  dayBranch: m.bazi_basis_day_branch,
  yearBranch: m.bazi_basis_year_branch,
}

export const CITY_LABEL: Record<CityId, Message> = {
  taipei: m.bazi_city_taipei,
  taichung: m.bazi_city_taichung,
  kaohsiung: m.bazi_city_kaohsiung,
  hongKong: m.bazi_city_hong_kong,
  macau: m.bazi_city_macau,
  beijing: m.bazi_city_beijing,
  shanghai: m.bazi_city_shanghai,
  guangzhou: m.bazi_city_guangzhou,
  seoul: m.bazi_city_seoul,
  busan: m.bazi_city_busan,
  daegu: m.bazi_city_daegu,
  tokyo: m.bazi_city_tokyo,
  singapore: m.bazi_city_singapore,
  kualaLumpur: m.bazi_city_kuala_lumpur,
  losAngeles: m.bazi_city_los_angeles,
  vancouver: m.bazi_city_vancouver,
  newYork: m.bazi_city_new_york,
  toronto: m.bazi_city_toronto,
  london: m.bazi_city_london,
  sydney: m.bazi_city_sydney,
}

/** 字段级错误文案；年份超出范围给出可用年份 */
export function issueMessage(issue: InputIssue): string {
  switch (issue.code) {
    case 'required':
      return m.bazi_issue_required()
    case 'out_of_range':
      return issue.field === 'year' ? m.bazi_issue_year_range() : m.bazi_issue_out_of_range()
    case 'invalid_date':
      return m.bazi_issue_invalid_date()
    case 'leap_month_not_exist':
      return m.bazi_issue_leap_month_not_exist()
    case 'longitude_required':
      return m.bazi_issue_longitude_required()
  }
}

/** 柱名列表，如「年柱、時柱」 */
export function pillarList(keys: readonly PillarKey[], separator: string): string {
  return keys.map((key) => PILLAR_LABEL[key]()).join(separator)
}
