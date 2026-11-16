import { seedBillingCatalog } from './fixtures.ts'

/**
 * 离线全量套件开始前写入示例目录（积分包与订阅档位）。
 * 公开定价目录在 dev 进程内缓存 1 小时（features/marketing/pricing-data.ts）：若先有用例在种子写入前
 * 打开 /pricing，后续用例即使再 seed 也只能看到缓存里的旧目录，结果取决于用例顺序。
 */
export default async function setup() {
  await seedBillingCatalog()
}
