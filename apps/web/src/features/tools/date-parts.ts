/**
 * 日期 / 时间分段输入的取值规则（纯函数，供 date-field.tsx 与测试使用）。
 *
 * 原生 `<input type="date|time">` 的占位符、分段顺序与上下午按浏览器界面语言显示，不跟随页面 lang：
 * 中文浏览器打开英文站会看到「年/月/日」。改用年月日、时分文本分段后，表单仍提交与原生控件相同的值
 * （`YYYY-MM-DD`、`HH:MM`），下游解析、校验、埋点与 `#r=` 分享链接保持不变。
 *
 * 不完整或越界的输入用空格连接各段（如 `1990 13 5`），保证不会被 `YYYY-MM-DD` / `HH:MM` 解析器接受，
 * 从而走原有的错误提示；同时保留原样，跨页恢复输入时能还原各段。
 */

export type DateParts = {
  readonly year: string
  readonly month: string
  readonly day: string
}

export type TimeParts = {
  readonly hour: string
  readonly minute: string
}

const inRange = (text: string, pattern: RegExp, min: number, max: number) =>
  pattern.test(text) && Number(text) >= min && Number(text) <= max

const pad2 = (text: string) => text.padStart(2, '0')

/** 各段 → 表单值：齐全且有效时为 `YYYY-MM-DD`，全空为空串，其余为空格连接的原样文本 */
export function joinDateParts(parts: DateParts): string {
  const year = parts.year.trim()
  const month = parts.month.trim()
  const day = parts.day.trim()
  if (!year && !month && !day) return ''
  // 年份要求 4 位，避免把正在输入的「199」当成公元 199 年
  if (
    inRange(year, /^\d{4}$/, 1, 9999) &&
    inRange(month, /^\d{1,2}$/, 1, 12) &&
    inRange(day, /^\d{1,2}$/, 1, 31)
  )
    return `${year}-${pad2(month)}-${pad2(day)}`
  return `${year} ${month} ${day}`
}

/** 表单值 → 各段：接受 `YYYY-MM-DD` 与 joinDateParts 输出的空格形式，其他值视为空 */
export function splitDateValue(value: string): DateParts {
  const pieces = value.split(/[- ]/)
  if (pieces.length !== 3) return { year: '', month: '', day: '' }
  const [year = '', month = '', day = ''] = pieces
  return { year, month, day }
}

/** 三段都已填写（是否有效另行判断），用于决定是否提示格式错误 */
export function dateValueComplete(value: string): boolean {
  const { year, month, day } = splitDateValue(value)
  return Boolean(year && month && day)
}

/** 各段 → 表单值：齐全且有效时为 `HH:MM`（24 小时制），全空为空串，其余为空格连接的原样文本 */
export function joinTimeParts(parts: TimeParts): string {
  const hour = parts.hour.trim()
  const minute = parts.minute.trim()
  if (!hour && !minute) return ''
  if (inRange(hour, /^\d{1,2}$/, 0, 23) && inRange(minute, /^\d{1,2}$/, 0, 59))
    return `${pad2(hour)}:${pad2(minute)}`
  return `${hour} ${minute}`
}

/** 表单值 → 各段：接受 `H:MM` / `HH:MM` 与 joinTimeParts 输出的空格形式，其他值视为空 */
export function splitTimeValue(value: string): TimeParts {
  const pieces = value.split(/[: ]/)
  if (pieces.length !== 2) return { hour: '', minute: '' }
  const [hour = '', minute = ''] = pieces
  return { hour, minute }
}
