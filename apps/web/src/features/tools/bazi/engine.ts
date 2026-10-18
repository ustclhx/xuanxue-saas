/**
 * 排盘引擎按需加载（决策 6）：表单与说明文字先渲染，提交或聚焦表单时才 import()。
 * 八字与紫微分两个 chunk，八字页面不加载 iztro。
 */
let bazi: Promise<typeof import('@xuanxue/bazi')> | undefined
let ziwei: Promise<typeof import('@xuanxue/bazi/ziwei')> | undefined

export function loadBazi() {
  bazi ??= import('@xuanxue/bazi').catch((error: unknown) => {
    // 网络失败后允许重试
    bazi = undefined
    throw error
  })
  return bazi
}

export function loadZiwei() {
  ziwei ??= import('@xuanxue/bazi/ziwei').catch((error: unknown) => {
    ziwei = undefined
    throw error
  })
  return ziwei
}
