import type { MajorStar, Mutagen, PalaceKey } from '@xuanxue/bazi/ziwei'
import { m } from '../../../paraglide/messages.js'

// 紫微斗数的宫名、星名、亮度、四化与五行局文案（紫微页与十二宫图形共用）
type Message = () => string

export const PALACE_LABEL: Record<PalaceKey, Message> = {
  soul: m.bazi_ziwei_palace_soul,
  siblings: m.bazi_ziwei_palace_siblings,
  spouse: m.bazi_ziwei_palace_spouse,
  children: m.bazi_ziwei_palace_children,
  wealth: m.bazi_ziwei_palace_wealth,
  health: m.bazi_ziwei_palace_health,
  surface: m.bazi_ziwei_palace_surface,
  friends: m.bazi_ziwei_palace_friends,
  career: m.bazi_ziwei_palace_career,
  property: m.bazi_ziwei_palace_property,
  spirit: m.bazi_ziwei_palace_spirit,
  parents: m.bazi_ziwei_palace_parents,
}

/** 十四主星与四化可能落到的辅星（文昌、文曲、左辅、右弼） */
export const STAR_LABEL: Record<MajorStar | 'wenchang' | 'wenqu' | 'zuofu' | 'youbi', Message> = {
  ziwei: m.bazi_ziwei_star_ziwei,
  tianji: m.bazi_ziwei_star_tianji,
  taiyang: m.bazi_ziwei_star_taiyang,
  wuqu: m.bazi_ziwei_star_wuqu,
  tiantong: m.bazi_ziwei_star_tiantong,
  lianzhen: m.bazi_ziwei_star_lianzhen,
  tianfu: m.bazi_ziwei_star_tianfu,
  taiyin: m.bazi_ziwei_star_taiyin,
  tanlang: m.bazi_ziwei_star_tanlang,
  jumen: m.bazi_ziwei_star_jumen,
  tianxiang: m.bazi_ziwei_star_tianxiang,
  tianliang: m.bazi_ziwei_star_tianliang,
  qisha: m.bazi_ziwei_star_qisha,
  pojun: m.bazi_ziwei_star_pojun,
  wenchang: m.bazi_ziwei_star_wenchang,
  wenqu: m.bazi_ziwei_star_wenqu,
  zuofu: m.bazi_ziwei_star_zuofu,
  youbi: m.bazi_ziwei_star_youbi,
}

export const BRIGHTNESS_LABEL: Record<string, Message> = {
  miao: m.bazi_ziwei_brightness_miao,
  wang: m.bazi_ziwei_brightness_wang,
  de: m.bazi_ziwei_brightness_de,
  li: m.bazi_ziwei_brightness_li,
  ping: m.bazi_ziwei_brightness_ping,
  bu: m.bazi_ziwei_brightness_bu,
  xian: m.bazi_ziwei_brightness_xian,
}

export const MUTAGEN_LABEL: Record<Mutagen, Message> = {
  lu: m.bazi_ziwei_mutagen_lu,
  quan: m.bazi_ziwei_mutagen_quan,
  ke: m.bazi_ziwei_mutagen_ke,
  ji: m.bazi_ziwei_mutagen_ji,
}

export const CLASS_LABEL: Record<string, Message> = {
  water2nd: m.bazi_ziwei_class_water2nd,
  wood3rd: m.bazi_ziwei_class_wood3rd,
  metal4th: m.bazi_ziwei_class_metal4th,
  earth5th: m.bazi_ziwei_class_earth5th,
  fire6th: m.bazi_ziwei_class_fire6th,
}

export const label = (table: Record<string, Message>, key: string) => table[key]?.() ?? key
