/**
 * 内置常用出生地：IANA 时区决定历史标准时间与夏令时，经度用于真太阳时。
 * 其他地点由访客手选 UTC 偏移（可附经度）。
 */
export const CITIES = {
  taipei: { zone: 'Asia/Taipei', longitude: 121.5654 },
  taichung: { zone: 'Asia/Taipei', longitude: 120.6736 },
  kaohsiung: { zone: 'Asia/Taipei', longitude: 120.3014 },
  hongKong: { zone: 'Asia/Hong_Kong', longitude: 114.1694 },
  macau: { zone: 'Asia/Macau', longitude: 113.5439 },
  beijing: { zone: 'Asia/Shanghai', longitude: 116.4074 },
  shanghai: { zone: 'Asia/Shanghai', longitude: 121.4737 },
  guangzhou: { zone: 'Asia/Shanghai', longitude: 113.2644 },
  seoul: { zone: 'Asia/Seoul', longitude: 126.978 },
  busan: { zone: 'Asia/Seoul', longitude: 129.0756 },
  daegu: { zone: 'Asia/Seoul', longitude: 128.6014 },
  tokyo: { zone: 'Asia/Tokyo', longitude: 139.6917 },
  singapore: { zone: 'Asia/Singapore', longitude: 103.8198 },
  kualaLumpur: { zone: 'Asia/Kuala_Lumpur', longitude: 101.6869 },
  losAngeles: { zone: 'America/Los_Angeles', longitude: -118.2437 },
  vancouver: { zone: 'America/Vancouver', longitude: -123.1207 },
  newYork: { zone: 'America/New_York', longitude: -74.006 },
  toronto: { zone: 'America/Toronto', longitude: -79.3832 },
  london: { zone: 'Europe/London', longitude: -0.1276 },
  sydney: { zone: 'Australia/Sydney', longitude: 151.2093 },
} as const satisfies Record<string, { zone: string; longitude: number }>

export type CityId = keyof typeof CITIES

export const CITY_IDS = Object.keys(CITIES) as CityId[]

export function isCityId(value: string): value is CityId {
  return Object.hasOwn(CITIES, value)
}
