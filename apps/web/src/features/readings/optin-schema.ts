import { z } from 'zod'

export const OPTIN_TOPICS = ['love', 'career', 'money', 'reunion', 'growth'] as const
export const optinResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bazi'),
    dayMaster: z.enum(['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui']),
  }),
  z.object({
    kind: z.literal('numerology'),
    lifePath: z.union([
      z.number().int().min(1).max(9),
      z.literal(11),
      z.literal(22),
      z.literal(33),
    ]),
  }),
  z.object({
    kind: z.literal('tarot'),
    cards: z
      .array(
        z.object({
          cardId: z.string().regex(/^(major-\d{2}|(?:wands|cups|swords|pentacles)-\d{2})$/),
          reversed: z.boolean(),
        }),
      )
      .min(1)
      .max(10),
  }),
])
export type OptinResult = z.infer<typeof optinResultSchema>

// 分享输入只接受有界标量；邮件链接的域名与路径始终由服务端的工具注册表决定。
const shareSchema = z
  .record(
    z.string().max(40),
    z.union([z.string().max(2048), z.number().finite(), z.boolean(), z.null()]),
  )
  .refine((value) => Object.keys(value).length <= 20)
export const readingOptinSchema = z.object({
  name: z.string().trim().max(80).default(''),
  sourceTool: z.string().max(60),
  topic: z.enum(OPTIN_TOPICS),
  site: z.enum(['east', 'west']),
  locale: z.enum(['en', 'zh-Hant', 'zh-Hans', 'ko']),
  result: optinResultSchema,
  share: shareSchema,
})
export type ReadingOptin = z.infer<typeof readingOptinSchema>

/** 页面只传结果摘要与可复现的分享输入，不上传完整命盘或塔罗问题。 */
export interface ReadingOptinData {
  readonly result: OptinResult
  readonly share: Readonly<Record<string, unknown>>
}
