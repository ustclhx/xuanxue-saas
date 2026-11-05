import { defineTemplateConfig, siteBrandName } from '@xuanxue/config'
import type { Database } from '@xuanxue/db'
import { expect, it, vi } from 'vitest'
import { notifyRefundRequest } from './notifications.ts'
import type { RefundNotification } from './refunds.ts'

it.each(['east', 'west'] as const)(
  'uses the %s applicant site for refund mail despite a shared email and locale',
  async (site) => {
    const queue = { send: vi.fn() }
    const config = defineTemplateConfig({
      app: { name: 'Test', url: 'https://arcanumber.com', supportEmail: 'support@arcanumber.com' },
    })
    const where = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ site, locale: 'ko' }])
    const db = {
      select: () => ({ from: () => ({ where }) }),
      insert: () => ({ values: vi.fn() }),
    } as unknown as Database
    await notifyRefundRequest(
      {
        db,
        queue,
        appName: (locale, site) => siteBrandName(config, site, locale),
        supportEmail: (_locale, site) => config.sites[site].supportEmail,
      },
      {
        request: {
          id: 'refund',
          status: 'approved',
          contactEmail: 'shared@example.com',
          userId: site,
          workspaceId: 'workspace',
          approvedAmount: 100,
          reviewNote: null,
        },
      } as RefundNotification,
    )
    expect(queue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        site,
        to: 'shared@example.com',
        locale: 'ko',
        appName: siteBrandName(config, site, 'ko'),
        props: expect.objectContaining({ supportEmail: config.sites[site].supportEmail }),
      }),
    )
  },
)
