/**
 * 构建日期（UTC，YYYY-MM-DD）：首页季节位与小标按它取舍（openspec content-growth-v2-tools 决策 5）。
 * 构建产物中是 vite.config.ts 注入的常量，服务端与客户端一致；单元测试与 Node 脚本中取当天，
 * 需要固定日期的测试把日期作为参数传入。
 */
export const BUILD_DATE: string =
  typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : new Date().toISOString().slice(0, 10)
