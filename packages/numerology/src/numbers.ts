import { AppError } from '@xuanxue/shared'

export interface Step {
  phase: 'month' | 'day' | 'year' | 'total' | 'digits'
  operands: number[]
  result: number
}
export interface NumberResult {
  value: number
  master: boolean
  steps: Step[]
}
export interface BirthDate {
  year: number
  month: number
  day: number
}
const masters = new Set([11, 22, 33])

export function reduceNumber(input: number, phase: Step['phase'] = 'digits'): NumberResult {
  if (!Number.isSafeInteger(input) || input < 0) {
    throw new AppError('INVALID_NUMBER', 'Expected a non-negative safe integer')
  }
  let value = input
  const steps: Step[] = []
  while (value > 9 && !masters.has(value)) {
    const operands = [...String(value)].map(Number)
    value = operands.reduce((sum, digit) => sum + digit, 0)
    steps.push({ phase, operands, result: value })
  }
  return { value, master: masters.has(value), steps }
}

function validateDate(date: BirthDate) {
  const { year, month, day } = date
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (
    ![year, month, day].every(Number.isInteger) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (days[month - 1] ?? 0)
  ) {
    throw new AppError('INVALID_BIRTH_DATE', 'Enter a valid Gregorian birth date', {
      details: { field: 'birthDate' },
    })
  }
}

export function lifePath(date: BirthDate): NumberResult {
  validateDate(date)
  const parts = [
    reduceNumber(date.month, 'month'),
    reduceNumber(date.day, 'day'),
    reduceNumber(date.year, 'year'),
  ]
  const operands = parts.map((part) => part.value)
  const sum = operands.reduce((a, b) => a + b, 0)
  const result = reduceNumber(sum, 'total')
  return {
    ...result,
    steps: [
      ...parts.flatMap((part) => part.steps),
      { phase: 'total', operands, result: sum },
      ...result.steps,
    ],
  }
}

export function birthdayNumber(date: BirthDate): NumberResult {
  validateDate(date)
  return reduceNumber(date.day, 'day')
}

// 调用方显式传入访客本地公历年，避免服务端 UTC 在跨年时改变结果。
export function personalYear(date: BirthDate, localYear: number): NumberResult {
  validateDate(date)
  if (!Number.isInteger(localYear) || localYear < 1 || localYear > 9999)
    throw new AppError('INVALID_YEAR', 'Enter a valid local year')
  const parts = [
    reduceNumber(date.month, 'month'),
    reduceNumber(date.day, 'day'),
    reduceNumber(localYear, 'year'),
  ]
  const operands = parts.map((part) => part.value)
  const sum = operands.reduce((a, b) => a + b, 0)
  const result = reduceNumber(sum, 'total')
  return {
    ...result,
    steps: [
      ...parts.flatMap((part) => part.steps),
      { phase: 'total', operands, result: sum },
      ...result.steps,
    ],
  }
}

/**
 * 每日数字（add-birth-profiles-daily-horoscope design D6）：宇宙日、个人月与个人日。
 * 结果按 1–9 与主数 11、22 解读，因此这里只保留 11、22，33 继续归约（个人年沿用原有规则）。
 * 「当日」由调用方显式传入访客本地日期，服务端不按 UTC 推断。
 */
const DAILY_MASTERS = new Set([11, 22])

function reduceDaily(input: number, phase: Step['phase'] = 'digits'): NumberResult {
  let value = input
  const steps: Step[] = []
  while (value > 9 && !DAILY_MASTERS.has(value)) {
    const operands = [...String(value)].map(Number)
    value = operands.reduce((sum, digit) => sum + digit, 0)
    steps.push({ phase, operands, result: value })
  }
  return { value, master: DAILY_MASTERS.has(value), steps }
}

/** 各部分归约后相加，再归约；步骤顺序为各部分、合计、合计的归约。 */
function sumParts(parts: NumberResult[], operands: number[]): NumberResult {
  const sum = operands.reduce((a, b) => a + b, 0)
  const result = reduceDaily(sum, 'total')
  return {
    ...result,
    steps: [
      ...parts.flatMap((part) => part.steps),
      { phase: 'total', operands, result: sum },
      ...result.steps,
    ],
  }
}

function validateLocalDate(date: BirthDate) {
  try {
    validateDate(date)
  } catch {
    throw new AppError('INVALID_DATE', 'Enter a valid local date', {
      details: { field: 'date' },
    })
  }
}

/** 宇宙日数：当日公历年、月、日分别归约后相加，再归约。 */
export function universalDay(local: BirthDate): NumberResult {
  validateLocalDate(local)
  const parts = [
    reduceDaily(local.year, 'year'),
    reduceDaily(local.month, 'month'),
    reduceDaily(local.day, 'day'),
  ]
  return sumParts(
    parts,
    parts.map((part) => part.value),
  )
}

export interface PersonalMonthResult extends NumberResult {
  personalYear: NumberResult
}
export interface PersonalDayResult extends NumberResult {
  personalYear: NumberResult
  personalMonth: PersonalMonthResult
}

/** 个人月数：个人年数（按本地年份）加当月数后归约。 */
export function personalMonth(
  birth: BirthDate,
  local: { year: number; month: number },
): PersonalMonthResult {
  validateLocalDate({ ...local, day: 1 })
  const year = personalYear(birth, local.year)
  const month = reduceDaily(local.month, 'month')
  const result = sumParts([month], [year.value, month.value])
  return { ...result, personalYear: year }
}

/**
 * 个人日数：个人月数加当日数后归约。`steps` 只含个人日这一段；
 * 个人年、个人月两段的步骤分别在 `personalYear.steps` 与 `personalMonth.steps`，页面依次展示。
 */
export function personalDay(birth: BirthDate, local: BirthDate): PersonalDayResult {
  validateLocalDate(local)
  const month = personalMonth(birth, local)
  const day = reduceDaily(local.day, 'day')
  const result = sumParts([day], [month.value, day.value])
  return { ...result, personalYear: month.personalYear, personalMonth: month }
}

/** 窗口内逐年个人年数（readings-prompt-v4-yearly）；每年与单年 `personalYear` 同一规则 */
export function personalYears(date: BirthDate, startYear: number, years: number) {
  if (!Number.isInteger(years) || years < 1 || years > 20)
    throw new AppError('INVALID_YEAR', 'Enter a valid number of years')
  return Array.from({ length: years }, (_, i) => {
    const year = startYear + i
    const result = personalYear(date, year)
    return { year, value: result.value, master: result.master }
  })
}

/** 归约到个位，不保留大师数：巅峰与挑战的月、日、年分量以及年龄起点都按个位计算 */
function digit(input: number): number {
  let value = input
  while (value > 9) value = [...String(value)].reduce((sum, d) => sum + Number(d), 0)
  return value
}

/** 巅峰数只保留 11、22（spec「巅峰数与挑战数」），33 继续归约 */
function pinnacleNumber(sum: number): { value: number; master: boolean } {
  let value = sum
  while (value > 9 && value !== 11 && value !== 22)
    value = [...String(value)].reduce((total, d) => total + Number(d), 0)
  return { value, master: value === 11 || value === 22 }
}

export interface LifePeriod {
  value: number
  master: boolean
  startAge: number
  /** 第四段持续终身，为 null */
  endAge: number | null
}

/**
 * 四段人生周期的起止年龄：第一段止于 36 减生命灵数个位值，其后每段 9 年，第四段到终身。
 * 相邻两段共用交界年龄（常见写法「到 X 岁」「从 X 岁起」）。
 */
function periodAges(date: BirthDate): [number, number | null][] {
  const first = 36 - digit(lifePath(date).value)
  return [
    [0, first],
    [first, first + 9],
    [first + 9, first + 18],
    [first + 18, null],
  ]
}

function dateDigits(date: BirthDate) {
  validateDate(date)
  return { m: digit(date.month), d: digit(date.day), y: digit(date.year) }
}

/** 毕达哥拉斯体系四个巅峰数：月+日、日+年、前两者之和、月+年 */
export function pinnacles(date: BirthDate): LifePeriod[] {
  const { m, d, y } = dateDigits(date)
  const first = pinnacleNumber(m + d)
  const second = pinnacleNumber(d + y)
  const values = [
    first,
    second,
    pinnacleNumber(digit(first.value) + digit(second.value)),
    pinnacleNumber(m + y),
  ]
  return periodAges(date).map(([startAge, endAge], i) => ({
    ...(values[i] as { value: number; master: boolean }),
    startAge,
    endAge,
  }))
}

/** 四个挑战数：|月−日|、|日−年|、前两者之差、|月−年|，取值 0–8，没有大师数 */
export function challenges(date: BirthDate): LifePeriod[] {
  const { m, d, y } = dateDigits(date)
  const first = Math.abs(m - d)
  const second = Math.abs(d - y)
  const values = [first, second, Math.abs(first - second), Math.abs(m - y)]
  return periodAges(date).map(([startAge, endAge], i) => ({
    value: values[i] as number,
    master: false,
    startAge,
    endAge,
  }))
}

export function normalizeName(name: string): string {
  // 先校验原始字母，避免大写转换把非基础拉丁字符悄悄变成 A–Z。
  const normalized = name.normalize('NFD').replace(/\p{M}/gu, '')
  if (!/^[a-zA-Z\s'’-]+$/.test(normalized) || !/[a-zA-Z]/.test(normalized)) {
    throw new AppError(
      'INVALID_NAME',
      'Use Latin letters (A–Z), with optional accents, spaces, apostrophes or hyphens',
      { details: { field: 'name' } },
    )
  }
  return normalized.toUpperCase().trim().replace(/\s+/g, ' ')
}

export function nameNumbers(name: string) {
  const normalized = normalizeName(name)
  const vowels: number[] = []
  const consonants: number[] = []
  // 分词保留词边界，Y 的相邻字母只来自同一个姓名片段。
  for (const word of normalized.split(/[\s'’-]+/)) {
    for (const [index, letter] of [...word].entries()) {
      const vowel =
        /[AEIOU]/.test(letter) ||
        (letter === 'Y' &&
          !/[AEIOU]/.test(word[index - 1] ?? '') &&
          !/[AEIOU]/.test(word[index + 1] ?? ''))
      const value = ((letter.charCodeAt(0) - 65) % 9) + 1
      ;(vowel ? vowels : consonants).push(value)
    }
  }
  const sum = (values: number[]) => reduceNumber(values.reduce((a, b) => a + b, 0))
  return {
    normalized,
    expression: sum([...vowels, ...consonants]),
    soulUrge: sum(vowels),
    personality: sum(consonants),
  }
}

export function numerologyChart(date: BirthDate, localYear: number, name?: string) {
  const result = {
    lifePath: lifePath(date),
    birthday: birthdayNumber(date),
    personalYear: personalYear(date, localYear),
  }
  if (!name?.trim()) return { ...result, name: null, nameError: null }
  try {
    return { ...result, name: nameNumbers(name), nameError: null }
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'INVALID_NAME') throw error
    return {
      ...result,
      name: null,
      nameError: { field: 'name' as const, code: error.code, message: error.message },
    }
  }
}
