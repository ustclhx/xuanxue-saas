import { requireFreshSession } from '@xuanxue/auth'
import { AppError } from '@xuanxue/shared'
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { baseLocale, locales, overwriteGetLocale } from '../../paraglide/runtime.js'
import { Route as InvitationRoute } from '../../routes/(auth)/accept-invitation.tsx'
import { Route as VerifyRoute } from '../../routes/(auth)/verify-email.tsx'
import { getInvitationPage } from '../workspace/workspace.functions.ts'
import { getEmailVerificationState } from './options.functions.ts'

const state = vi.hoisted(() => ({ search: {}, verified: false }))
const runtime = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator: { parse(input: unknown): unknown } | undefined
    const builder = {
      middleware: () => builder,
      validator: (schema: typeof validator) => {
        validator = schema
        return builder
      },
      handler:
        (handler: (input: unknown) => unknown) =>
        (input: { data?: unknown } = {}) =>
          handler({ data: validator ? validator.parse(input.data) : input.data }),
    }
    return builder
  },
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: object) => ({
    options,
    useSearch: () => state.search,
    useLoaderData: () =>
      path.includes('accept-invitation')
        ? { error: 'INVITATION_INVALID' }
        : { verified: state.verified },
  }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/login">{children}</a>,
}))
vi.mock('@xuanxue/auth', () => ({ requireFreshSession: vi.fn() }))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://localhost'),
}))
vi.mock('../../server/runtime.ts', () => ({ getWebRuntime: runtime }))
vi.mock('../../server/middleware.ts', () => ({ withWorkspace: {} }))
vi.mock('../../server/workspace-data.ts', () => ({
  recipientInvitation: vi.fn(),
  resolveWorkspaceMaxSeats: vi.fn(),
  userWorkspaces: vi.fn(),
  workspaceInvitations: vi.fn(),
  workspaceMembers: vi.fn(),
}))
vi.mock('./auth-layout.tsx', () => ({
  authLinkClassName: '',
  AuthLayout: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
  FormAlert: ({ message }: { message: string }) => <p role="alert">{message}</p>,
  StatusAlert: ({ children }: { children: React.ReactNode }) => <p role="status">{children}</p>,
}))

beforeEach(() => {
  state.search = {}
  state.verified = false
  runtime.mockReset()
  vi.mocked(requireFreshSession).mockReset()
  overwriteGetLocale(() => baseLocale)
})

describe('public auth entry guards', () => {
  it.each([{}, { id: '' }, { id: 'invalid' }, { id: ['invalid'] }])(
    'treats missing or malformed invitation input %j as unavailable before session/database access',
    async (data) => {
      const validate = InvitationRoute.options.validateSearch as { parse(input: unknown): unknown }
      expect(() => validate.parse(data)).not.toThrow()
      await expect(getInvitationPage({ data: data as { id: string } })).resolves.toMatchObject({
        error: 'INVITATION_INVALID',
      })
      expect(runtime).not.toHaveBeenCalled()
    },
  )

  it.each(locales)('renders the invalid invitation and return entry in %s', (locale) => {
    overwriteGetLocale(() => locale)
    const Component = InvitationRoute.options.component as ComponentType
    const html = renderToString(<Component />)
    expect(html).toContain(m.auth_invitation_link_invalid())
    expect(html).toContain(m.auth_back_to_sign_in())
    expect(html).toContain('href="/login"')
  })

  it('reads actual verification status and treats unauthenticated sessions as unverified', async () => {
    runtime.mockReturnValue({ auth: {}, db: {} })
    vi.mocked(requireFreshSession).mockRejectedValue(
      new AppError('SESSION_REQUIRED', 'Sign in required', { status: 401 }),
    )
    await expect(getEmailVerificationState()).resolves.toEqual({ verified: false })
    vi.mocked(requireFreshSession).mockResolvedValue({ user: { emailVerified: true } } as Awaited<
      ReturnType<typeof requireFreshSession>
    >)
    await expect(getEmailVerificationState()).resolves.toEqual({ verified: true })
  })

  it.each(locales)(
    'shows an invalid verification link instead of success for an anonymous visit in %s',
    (locale) => {
      overwriteGetLocale(() => locale)
      const Component = VerifyRoute.options.component as ComponentType
      const html = renderToString(<Component />)
      expect(html).toContain(m.auth_verification_link_invalid())
      expect(html).not.toContain('role="status"')
      expect(html).toContain('href="/login"')
    },
  )

  it('shows success only when the loaded session confirms a verified email', () => {
    state.verified = true
    const Component = VerifyRoute.options.component as ComponentType
    expect(renderToString(<Component />)).toContain('role="status"')
  })
})
