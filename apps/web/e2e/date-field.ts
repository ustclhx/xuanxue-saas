import type { Locator, Page } from '@playwright/test'

/**
 * 日期 / 时间分段字段（src/features/tools/date-field.tsx）的填写辅助：
 * 字段是以标题命名的 group，内含 data-part 标记的数字分段，提交值在同名隐藏字段中。
 */

const group = (scope: Page | Locator, label: string) =>
  scope.getByRole('group', { name: label, exact: true })

/** 按 YYYY-MM-DD 填写年 / 月 / 日分段 */
export async function fillDate(scope: Page | Locator, label: string, iso: string) {
  const [year = '', month = '', day = ''] = iso.split('-')
  const field = group(scope, label)
  await field.locator('[data-part="year"]').fill(year)
  await field.locator('[data-part="month"]').fill(month)
  await field.locator('[data-part="day"]').fill(day)
}

/** 按 HH:MM 填写时 / 分分段 */
export async function fillTime(scope: Page | Locator, label: string, time: string) {
  const [hour = '', minute = ''] = time.split(':')
  const field = group(scope, label)
  await field.locator('[data-part="hour"]').fill(hour)
  await field.locator('[data-part="minute"]').fill(minute)
}

/** 按字段名定位时间分段（同一页有两个人、标题相同时用 name 区分） */
export async function fillTimeByName(scope: Page | Locator, name: string, time: string) {
  const [hour = '', minute = ''] = time.split(':')
  const field = scope.locator(`[data-field="${name}"]`)
  await field.locator('[data-part="hour"]').fill(hour)
  await field.locator('[data-part="minute"]').fill(minute)
}
