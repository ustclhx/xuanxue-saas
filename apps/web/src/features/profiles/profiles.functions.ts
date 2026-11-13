import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { z } from 'zod'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { type ProfileIssue, profileFieldsInput } from './schema.ts'
import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  type ProfileContext,
  setDefaultProfile,
  updateProfile,
} from './service.ts'

/**
 * 出生档案的 Server Functions（add-birth-profiles-daily-horoscope design D3）：
 * `withSession → withWorkspace`，且只在个人空间可用（团队空间的成员可见性本轮不做），
 * 团队空间与他人档案一律按不存在处理。日志只记录档案 id，见 service.ts。
 */

const slugInput = z.object({ slug: z.string().min(1).max(64) })
const idInput = slugInput.extend({ id: z.uuid() })

function personal(context: {
  db: ProfileContext['db']
  workspace: { id: string; isPersonal: boolean }
  user: { id: string }
}): ProfileContext {
  if (!context.workspace.isPersonal) throw notFound()
  return { db: context.db, workspaceId: context.workspace.id, userId: context.user.id }
}

/** 写操作的业务失败（校验、上限、「本人」重复、不存在）在页面上逐项提示 */
export type ProfileFailureCode =
  | 'INVALID_PROFILE'
  | 'PROFILE_LIMIT'
  | 'PROFILE_SELF_EXISTS'
  | 'NOT_FOUND'
export type ProfileOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ProfileFailureCode; readonly issues: ProfileIssue[] }

const FAILURE_CODES = new Set<string>([
  'INVALID_PROFILE',
  'PROFILE_LIMIT',
  'PROFILE_SELF_EXISTS',
  'NOT_FOUND',
])

/**
 * 抛出的 AppError 经 server function 序列化后只剩 message，页面无法按错误码与字段提示，
 * 因此写操作把业务错误换成返回值（与 deletion.functions.ts 相同）；其余错误照常抛出。
 * issues 只含字段名与错误码，不回显输入值。
 */
async function outcome<T>(run: () => Promise<T>): Promise<ProfileOutcome<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    if (!(error instanceof AppError) || !FAILURE_CODES.has(error.code)) throw error
    const issues = (error.details?.issues ?? []) as ProfileIssue[]
    return { ok: false, code: error.code as ProfileFailureCode, issues }
  }
}

export const listBirthProfiles = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .inputValidator(slugInput)
  .handler(({ context }) => listProfiles(personal(context)))

export const getBirthProfile = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .inputValidator(idInput)
  .handler(({ context, data }) => getProfile(personal(context), data.id))

export const createBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(
    slugInput.extend({ profile: profileFieldsInput, makeDefault: z.boolean().optional() }),
  )
  .handler(({ context, data }) =>
    outcome(() =>
      createProfile(personal(context), getWebRuntime().site, data.profile, {
        makeDefault: data.makeDefault,
      }),
    ),
  )

export const updateBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(idInput.extend({ profile: profileFieldsInput }))
  .handler(({ context, data }) =>
    outcome(() => updateProfile(personal(context), getWebRuntime().site, data.id, data.profile)),
  )

export const deleteBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(idInput)
  .handler(({ context, data }) => outcome(() => deleteProfile(personal(context), data.id)))

export const setDefaultBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(idInput)
  .handler(({ context, data }) => outcome(() => setDefaultProfile(personal(context), data.id)))
