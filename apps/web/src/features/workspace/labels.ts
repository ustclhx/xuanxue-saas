import { m } from '../../paraglide/messages.js'

// 与 @xuanxue/auth 的 PERSONAL_WORKSPACE_NAME 一致；不直接导入，避免客户端打包认证服务端代码
export const DEFAULT_PERSONAL_WORKSPACE_NAME = 'Personal'

const roleLabels: Record<string, () => string> = {
  owner: () => m.workspace_role_owner(),
  admin: () => m.workspace_role_admin(),
  member: () => m.workspace_role_member(),
}

export function roleLabel(role: string) {
  return roleLabels[role]?.() ?? role
}

/** 个人空间仍是建号时的默认英文名时按当前语言显示；用户改过的名称原样显示 */
export function workspaceDisplayName(workspace: {
  readonly name: string
  readonly isPersonal: boolean
}) {
  return workspace.isPersonal && workspace.name === DEFAULT_PERSONAL_WORKSPACE_NAME
    ? m.app_personal_workspace_name()
    : workspace.name
}
