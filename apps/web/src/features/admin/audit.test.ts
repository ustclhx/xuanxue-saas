import { describe, expect, it } from 'vitest'
import { auditSearchSchema } from './audit.ts'
import { NO_MATCH_WORKSPACE_ID } from './list.ts'

describe('审计筛选校验', () => {
  it('自由文本筛选非法时按无匹配处理，不抛出校验错误', () => {
    expect(
      auditSearchSchema.parse({ offset: 0, workspaceId: 'ops@example.com', from: '2026/11/01' }),
    ).toEqual({ offset: 0, workspaceId: NO_MATCH_WORKSPACE_ID, from: '9999-12-31' })
    expect(auditSearchSchema.parse({ offset: 0, to: 'yesterday' }).to).toBe('9999-12-31')
    // 开始晚于结束不再报错，查询条件自然为空
    expect(auditSearchSchema.parse({ offset: 0, from: '2026-11-05', to: '2026-11-01' })).toEqual({
      offset: 0,
      from: '2026-11-05',
      to: '2026-11-01',
    })
    expect(auditSearchSchema.parse({ offset: 0, from: ' ', to: '' })).toEqual({ offset: 0 })
  })
})
