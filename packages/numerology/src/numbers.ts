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
