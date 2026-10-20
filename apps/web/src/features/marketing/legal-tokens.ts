/**
 * 法律页中按站点替换的值：构建时把 `{{supportEmail}}` 换成这个纯文本标记（MDX 会把残留的 `{{…}}`
 * 当作 JSX 表达式），渲染时再替换为当前站点的联系邮箱。content-collections.ts 也引用这里。
 */
export const SUPPORT_EMAIL_TOKEN = '%SUPPORT_EMAIL%'
