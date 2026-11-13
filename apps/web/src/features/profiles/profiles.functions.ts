import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@xuanxue/db'
import { z } from 'zod'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { profileFieldsInput } from './schema.ts'
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
    createProfile(personal(context), getWebRuntime().site, data.profile, {
      makeDefault: data.makeDefault,
    }),
  )

export const updateBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(idInput.extend({ profile: profileFieldsInput }))
  .handler(({ context, data }) =>
    updateProfile(personal(context), getWebRuntime().site, data.id, data.profile),
  )

export const deleteBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(idInput)
  .handler(({ context, data }) => deleteProfile(personal(context), data.id))

export const setDefaultBirthProfile = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(idInput)
  .handler(({ context, data }) => setDefaultProfile(personal(context), data.id))
