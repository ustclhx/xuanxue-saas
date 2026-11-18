import { createServerFn } from '@tanstack/react-start'
import { grantSignupBonus } from '@xuanxue/billing'
import { withCredits } from '../../server/feature-gates.ts'
import { withSession } from '../../server/middleware.ts'
import { signupBonusConfig } from './signup-eligibility.ts'

/** Identity and verification are resolved from the database, never from browser input. */
export const claimSignupBonus = createServerFn({ method: 'POST' })
  .middleware([withCredits, withSession])
  .handler(async ({ context }) =>
    grantSignupBonus({
      db: context.db,
      userId: context.user.id,
      config: await signupBonusConfig(context.db, context.user.id),
    }),
  )
