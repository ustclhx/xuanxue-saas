/** 构建时由 vite.config.ts 从 package.json 注入 */
declare const __APP_VERSION__: string
/** 构建日期（UTC，YYYY-MM-DD），由 vite.config.ts 注入；单元测试与 Node 脚本中未定义 */
declare const __BUILD_DATE__: string | undefined
