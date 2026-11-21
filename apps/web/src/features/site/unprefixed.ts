/**
 * 东方站上不跳转到入口页的无前缀路径（应用区另见 APP_AREA_PREFIXES）。
 * 单独成模块：return-path.ts 随客户端入口加载，只需要这张表，不引入站点守卫（gate.ts）及其依赖的注册表。
 */
export const EAST_UNPREFIXED_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invitation',
] as const
