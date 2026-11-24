// 供 apps/web 单测引用的类型声明（脚本本身为纯 JS）
export function recomputeFacts(): string[]
export function factIssues(text: string, own: string | null): { issues: string[]; checked: number }
