import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { type Browser, expect as baseExpect, type Page, test } from '@playwright/test'
import { AUTH_FORM_COPY, register, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

// add-birth-profiles-daily-horoscope tasks 5.3 / 6.2 / 6.3：两站各自登录后新建、编辑、设为默认、删除档案，
// 再在工具页从档案填入并在浏览器本地出结果。本地按 Host 识别站点（east.localhost / west.localhost）。
// 截图写入 EVIDENCE_DIR（未设置时 test-results/evidence），不进仓库。

const expect = baseExpect.configure({ timeout: 20_000 })
const EVIDENCE = join(process.env.EVIDENCE_DIR ?? 'test-results/evidence', 'profiles-e2e')
const HYDRATED = { waitUntil: 'networkidle' } as const

async function siteContext(browser: Browser, baseURL: string | undefined, site: 'east' | 'west') {
  const url = new URL(baseURL ?? '')
  url.hostname = `${site}.localhost`
  const context = await browser.newContext({ baseURL: url.origin })
  const page = await context.newPage()
  await context.route('**/*', async (route) => {
    const target = new URL(route.request().url())
    if (target.origin === url.origin) return route.fallback()
    await route.abort()
  })
  await stubTurnstile(page)
  await simulateClientIp(page)
  return { context, page }
}

async function snap(page: Page, name: string) {
  mkdirSync(EVIDENCE, { recursive: true })
  await page.screenshot({ path: join(EVIDENCE, `${name}.png`), fullPage: true })
}

const row = (page: Page, name: string) =>
  page.locator('tr[data-profile-id]').filter({ has: page.getByText(name, { exact: true }) })

/** dev 下按需编译，首次点击可能早于水合：重复点击直到目标出现 */
async function clickUntil(page: Page, button: string, visible: string) {
  await expect
    .poll(async () => {
      if (await page.getByRole('form', { name: visible }).isVisible()) return true
      await page.getByRole('button', { name: button, exact: true }).click()
      return page.getByRole('form', { name: visible }).isVisible()
    })
    .toBe(true)
}

async function chooseRelation(page: Page, scope: string, label: string, option: string) {
  await page.getByRole('form', { name: scope }).getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('东方站：档案增改、设为默认、删除，工具页从档案填入与另存为档案', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const { context, page } = await siteContext(browser, baseURL, 'east')
  try {
    await register(
      page,
      `profiles-east-${randomUUID()}@example.com`,
      'East',
      AUTH_FORM_COPY['zh-Hant'],
    )
    const slug = new URL(page.url()).pathname.split('/')[2] ?? ''
    await page.goto(`/app/${slug}/profiles`, HYDRATED)
    await expect(page.getByRole('heading', { name: '出生檔案', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: '出生檔案' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByText('還沒有出生檔案')).toBeVisible()
    await snap(page, 'east-empty')

    // 新建「我」：第一份自动成为默认
    await clickUntil(page, '新增第一份檔案', '新增出生檔案')
    const create = page.getByRole('form', { name: '新增出生檔案' })
    await create.getByLabel('名稱（只給你自己看）').fill('我')
    await create.getByLabel('年', { exact: true }).fill('1990')
    await create.getByLabel('月', { exact: true }).fill('5')
    await create.getByLabel('日', { exact: true }).fill('15')
    await create.getByLabel('出生時間').fill('10:30')
    await snap(page, 'east-editor')
    await create.getByRole('button', { name: '儲存' }).click()
    await expect(row(page, '我')).toContainText('預設')
    await expect(row(page, '我')).toContainText('本人')
    await expect(row(page, '我')).toContainText('1990-05-15 10:30')
    await expect(row(page, '我')).toContainText('庚金')

    // 第二份：家人，不是默认
    await clickUntil(page, '新增檔案', '新增出生檔案')
    const second = page.getByRole('form', { name: '新增出生檔案' })
    await second.getByLabel('名稱（只給你自己看）').fill('媽媽')
    await chooseRelation(page, '新增出生檔案', '關係', '家人')
    await second.getByLabel('年', { exact: true }).fill('1962')
    await second.getByLabel('月', { exact: true }).fill('9')
    await second.getByLabel('日', { exact: true }).fill('3')
    await second.getByLabel('出生時間').fill('06:15')
    await second.getByRole('button', { name: '儲存' }).click()
    await expect(row(page, '媽媽')).toContainText('家人')
    await expect(row(page, '媽媽')).not.toContainText('預設')

    // 第二份「本人」被拒，并在关系字段提示
    await row(page, '媽媽').getByRole('button', { name: '編輯' }).click()
    const edit = page.getByRole('form', { name: '編輯出生檔案' })
    await chooseRelation(page, '編輯出生檔案', '關係', '本人')
    await edit.getByRole('button', { name: '儲存' }).click()
    await expect(edit.getByText('只能有一份關係為「本人」的檔案。')).toBeVisible()
    // 改回家人并改名
    await chooseRelation(page, '編輯出生檔案', '關係', '家人')
    await edit.getByLabel('名稱（只給你自己看）').fill('母親')
    await edit.getByRole('button', { name: '儲存' }).click()
    await expect(row(page, '母親')).toContainText('1962-09-03 06:15')

    // 设为默认：默认标记移到「母親」
    await row(page, '母親').getByRole('button', { name: '更多操作：母親' }).click()
    await page.getByRole('menuitem', { name: '設為預設' }).click()
    await expect(row(page, '母親')).toContainText('預設')
    await expect(row(page, '我')).not.toContainText('預設')
    await snap(page, 'east-list')

    // 删除「我」
    await row(page, '我').getByRole('button', { name: '更多操作：我' }).click()
    await page.getByRole('menuitem', { name: '刪除' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '刪除' }).click()
    await expect(row(page, '我')).toHaveCount(0)
    await expect(page.getByText('已刪除檔案。')).toBeVisible()

    // 工具页：从档案填入后提交，结果与手动填写一致
    await page.goto('/zh-hant', HYDRATED)
    await page.getByRole('button', { name: '從檔案帶入' }).click()
    await page.getByRole('button', { name: /母親/ }).click()
    await expect(page.getByText('已帶入「母親」。')).toBeVisible()
    await page.getByRole('button', { name: '立即排盤' }).click()
    await expect(page.locator('#pillars')).toContainText('1962-09-03 06:15')
    const filled = await page.locator('#pillars [data-pillar]').allInnerTexts()
    await snap(page, 'east-tool-filled')

    await page.evaluate(() => sessionStorage.clear())
    await page.goto('/zh-hant', HYDRATED)
    await page.getByLabel('年', { exact: true }).fill('1962')
    await page.getByLabel('月', { exact: true }).fill('9')
    await page.getByLabel('日', { exact: true }).fill('3')
    await page.getByLabel('出生時間').fill('06:15')
    await page.getByRole('button', { name: '立即排盤' }).click()
    await expect(page.locator('#pillars')).toContainText('1962-09-03 06:15')
    expect(await page.locator('#pillars [data-pillar]').allInnerTexts()).toEqual(filled)

    // 另存为档案：表单内容不变，新档案出现在列表
    await page.getByRole('button', { name: '另存為檔案' }).click()
    const save = page.getByRole('form', { name: '另存為出生檔案' })
    await save.getByLabel('名稱（只給你自己看）').fill('媽媽另存')
    await chooseRelation(page, '另存為出生檔案', '關係', '家人')
    await save.getByRole('button', { name: '儲存' }).click()
    await expect(page.getByText('已存為檔案「媽媽另存」。')).toBeVisible()
    await expect(page.getByLabel('年', { exact: true })).toHaveValue('1962')
    await page.goto(`/app/${slug}/profiles`, HYDRATED)
    await expect(row(page, '媽媽另存')).toContainText('家人')
  } finally {
    await context.close()
  }
})

test('西方站：档案只需日期，数字命理计算器从档案填入后离线计算', async ({ browser, baseURL }) => {
  test.setTimeout(150_000)
  const { context, page } = await siteContext(browser, baseURL, 'west')
  try {
    await register(page, `profiles-west-${randomUUID()}@example.com`, 'West')
    const slug = new URL(page.url()).pathname.split('/')[2] ?? ''
    await page.goto(`/app/${slug}/profiles`, HYDRATED)
    await expect(page.getByRole('heading', { name: 'Birth profiles', level: 1 })).toBeVisible()

    await clickUntil(page, 'Add your first profile', 'New birth profile')
    const create = page.getByRole('form', { name: 'New birth profile' })
    await create.getByLabel('Name (only you see this)').fill('Me')
    await create.getByLabel('Date of birth').fill('1987-11-29')
    await create.getByLabel(/Full birth name/).fill('Jane Doe')
    await create.getByRole('button', { name: 'Save' }).click()
    await expect(row(page, 'Me')).toContainText('Default')
    await expect(row(page, 'Me')).toContainText('1987-11-29')
    await expect(row(page, 'Me')).toContainText('11')

    await clickUntil(page, 'New profile', 'New birth profile')
    const second = page.getByRole('form', { name: 'New birth profile' })
    await second.getByLabel('Name (only you see this)').fill('Sam')
    await chooseRelation(page, 'New birth profile', 'Relation', 'Partner')
    await second.getByLabel('Date of birth').fill('1991-12-24')
    await second.getByRole('button', { name: 'Save' }).click()
    await expect(row(page, 'Sam')).toContainText('Partner')

    await row(page, 'Sam').getByRole('button', { name: 'Edit' }).click()
    const edit = page.getByRole('form', { name: 'Edit birth profile' })
    await edit.getByLabel('Name (only you see this)').fill('Sam R')
    await edit.getByRole('button', { name: 'Save' }).click()
    await expect(row(page, 'Sam R')).toBeVisible()

    await row(page, 'Sam R').getByRole('button', { name: 'More actions: Sam R' }).click()
    await page.getByRole('menuitem', { name: 'Make default' }).click()
    await expect(row(page, 'Sam R')).toContainText('Default')
    await snap(page, 'west-list')

    await row(page, 'Sam R').getByRole('button', { name: 'More actions: Sam R' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(row(page, 'Sam R')).toHaveCount(0)
    // 删除默认档案后，剩下的一份自动成为默认
    await expect(row(page, 'Me')).toContainText('Default')

    // 完整计算器：从档案填入日期与全名，断网后提交仍在本地出结果
    await page.goto('/numerology-calculator', HYDRATED)
    await page.getByRole('button', { name: 'Fill from profile' }).click()
    await page.getByRole('button', { name: /Me/ }).click()
    await expect(page.getByLabel('Date of birth')).toHaveValue('1987-11-29')
    await expect(page.getByLabel('Full name (optional)')).toHaveValue('Jane Doe')
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Calculate' }).click()
    await expect(page.locator('#life-path')).toContainText('11')
    await expect(page.locator('#expression')).toBeVisible()
    await context.setOffline(false)
    await snap(page, 'west-tool-filled')
  } finally {
    await context.close()
  }
})
