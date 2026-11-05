import { PERSONAL_WORKSPACE_NAME } from '@xuanxue/auth'
import { describe, expect, it } from 'vitest'
import { overwriteGetLocale } from '../../paraglide/runtime.js'
import { DEFAULT_PERSONAL_WORKSPACE_NAME, roleLabel, workspaceDisplayName } from './labels.ts'

describe('workspace labels', () => {
  it('默认个人空间名与建号时写入的名称一致', () => {
    expect(DEFAULT_PERSONAL_WORKSPACE_NAME).toBe(PERSONAL_WORKSPACE_NAME)
  })

  it('默认个人空间名与角色按当前语言显示，自定义名称保持原文', () => {
    overwriteGetLocale(() => 'zh-Hant')
    expect(workspaceDisplayName({ name: 'Personal', isPersonal: true })).toBe('我的空間')
    expect(workspaceDisplayName({ name: 'Personal', isPersonal: false })).toBe('Personal')
    expect(workspaceDisplayName({ name: '家人', isPersonal: true })).toBe('家人')
    expect(roleLabel('owner')).toBe('所有者')
    expect(roleLabel('unknown')).toBe('unknown')
  })
})
