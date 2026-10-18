// lunar-javascript 未附带类型，仅作测试期交叉校验 oracle 使用
declare module 'lunar-javascript' {
  // biome-ignore lint/suspicious/noExplicitAny: 第三方库无类型
  export const Solar: any
  export const LunarUtil: { SHI_SHEN: Record<string, string> }
}
