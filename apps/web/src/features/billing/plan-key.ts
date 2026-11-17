// 定价页带到 /app 与计费页的套餐 key（`?buy=`）。路由 validateSearch 会进入水合时立即加载的路由树分包
// （模板 0.5.6），这里不用 zod；格式与此前的 `z.string().regex(/^[a-z0-9_-]{1,64}$/)` 相同。
const PLAN_KEY = /^[a-z0-9_-]{1,64}$/

/** 可选的套餐 key 参数：格式不符时视为未提供 */
export function planKey(value: unknown): string | undefined {
  return typeof value === 'string' && PLAN_KEY.test(value) ? value : undefined
}
