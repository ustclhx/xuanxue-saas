import { BIRTH_PROFILE_RELATIONS } from '@xuanxue/db'
import { describe, expect, it } from 'vitest'
import { profileFor } from './prefill.ts'
import { PROFILE_RELATIONS, parseProfileInput, validateProfileInput } from './schema.ts'

const EAST = {
  label: '  本人  ',
  relation: 'self',
  birth: {
    calendar: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    time: { hour: 10, minute: 30 },
    gender: 'male',
    location: { city: 'taipei' },
  },
  fullName: 'Ignored on east',
}

const WEST = {
  relation: 'partner',
  birth: {
    calendar: 'solar',
    year: 1987,
    month: 11,
    day: 29,
    time: null,
    gender: null,
    location: null,
  },
  fullName: 'Hélène Dupont',
}

describe('birthProfileSchema', () => {
  it('关系列表与数据库约束一致', () => {
    expect(PROFILE_RELATIONS).toEqual(BIRTH_PROFILE_RELATIONS)
  })

  it('东方站：完整资料通过，显示名去空白、全名清空', () => {
    const result = validateProfileInput('east', EAST)
    expect(result).toEqual({
      ok: true,
      value: {
        label: '本人',
        relation: 'self',
        birth: EAST.birth,
        fullName: null,
      },
    })
  })

  it('东方站缺性别或出生地时拒绝', () => {
    const result = validateProfileInput('east', {
      ...EAST,
      birth: { ...EAST.birth, gender: null, location: null },
    })
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: 'gender', code: 'required' },
        { field: 'location', code: 'required' },
      ],
    })
  })

  it('西方站只填日期即通过，保留全名；空显示名为 null', () => {
    const result = validateProfileInput('west', { ...WEST, label: '' })
    expect(result).toEqual({
      ok: true,
      value: { label: null, relation: 'partner', birth: WEST.birth, fullName: 'Hélène Dupont' },
    })
  })

  it('西方站不接受农历', () => {
    const result = validateProfileInput('west', {
      ...WEST,
      birth: { ...WEST.birth, calendar: 'lunar' },
    })
    expect(result).toMatchObject({ ok: false, issues: [{ field: 'calendar', code: 'invalid' }] })
  })

  it('农历 2023 年闰三月（该年闰二月）被拒绝，错误落在闰月字段', () => {
    const result = validateProfileInput('east', {
      ...EAST,
      birth: { ...EAST.birth, calendar: 'lunar', year: 2023, month: 3, isLeapMonth: true },
    })
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'leapMonth', code: 'leap_month_not_exist' }],
    })
    expect(
      validateProfileInput('east', {
        ...EAST,
        birth: { ...EAST.birth, calendar: 'lunar', year: 2023, month: 2, isLeapMonth: true },
      }).ok,
    ).toBe(true)
  })

  it('不存在的日期、过长的显示名、未知关系都给出字段级错误', () => {
    expect(
      validateProfileInput('west', { ...WEST, birth: { ...WEST.birth, month: 2, day: 30 } }),
    ).toEqual({ ok: false, issues: [{ field: 'day', code: 'invalid_date' }] })
    expect(validateProfileInput('west', { ...WEST, label: 'x'.repeat(41) })).toEqual({
      ok: false,
      issues: [{ field: 'label', code: 'too_long' }],
    })
    expect(validateProfileInput('west', { ...WEST, relation: 'boss' })).toEqual({
      ok: false,
      issues: [{ field: 'relation', code: 'invalid' }],
    })
  })

  it('没有出生地时去掉真太阳时偏好', () => {
    const result = validateProfileInput('west', {
      ...WEST,
      birth: { ...WEST.birth, trueSolarTime: true },
    })
    expect(result.ok && 'trueSolarTime' in result.value.birth).toBe(false)
  })

  it('parseProfileInput 的错误只含字段与错误码，不回显输入', () => {
    try {
      parseProfileInput('east', { ...EAST, birth: { ...EAST.birth, gender: null } })
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_PROFILE',
        status: 400,
        details: { issues: [{ field: 'gender', code: 'required' }] },
      })
      expect(JSON.stringify(error)).not.toContain('1990')
    }
  })
})

describe('profileFor', () => {
  const east = { birth: EAST.birth, fullName: null } as never
  it('八字工具：填入全部已有字段，没有缺失', () => {
    expect(profileFor('bazi', east)).toEqual({
      values: {
        calendar: 'solar',
        leap: false,
        year: '1990',
        month: '5',
        day: '15',
        time: '10:30',
        unknownTime: false,
        gender: 'male',
        place: 'taipei',
        trueSolar: false,
      },
      missing: [],
    })
  })

  it('缺少性别时只预填已有字段，并列出缺失项；紫微另要求时辰', () => {
    const profile = {
      birth: { ...WEST.birth, location: { utcOffsetMinutes: -300, longitude: -74 } },
      fullName: null,
    } as never
    const bazi = profileFor('bazi', profile)
    expect(bazi.missing).toEqual(['gender'])
    expect(bazi.values).not.toHaveProperty('gender')
    expect(bazi.values).toMatchObject({
      place: 'other',
      utcOffset: '-300',
      longitude: '-74',
      unknownTime: true,
      time: '',
    })
    expect(profileFor('ziwei', profile).missing).toEqual(['gender', 'time'])
  })

  it('数字命理：填入日期与全名；农历档案提示补填公历日期', () => {
    expect(
      profileFor('numerology', { birth: WEST.birth, fullName: 'Hélène Dupont' } as never),
    ).toEqual({ values: { birthDate: '1987-11-29', name: 'Hélène Dupont' }, missing: [] })
    expect(
      profileFor('numerology', {
        birth: { ...EAST.birth, calendar: 'lunar' },
        fullName: null,
      } as never),
    ).toEqual({ values: {}, missing: ['birthDate'] })
  })
})
