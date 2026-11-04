/**
 * 保证不存在的路径（不要为它新增路由）。
 * 单独成文件：站点与语言守卫也会被浏览器代码引用（return-path.ts → site/gate.ts），
 * 不能经 admin/gate.ts 把 @xuanxue/auth 等服务端模块带进客户端。
 */
export const NOT_FOUND_PATH = '/__not-found'
