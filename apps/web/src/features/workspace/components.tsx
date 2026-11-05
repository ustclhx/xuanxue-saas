import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useAppForm,
} from '@xuanxue/ui'
import { type ReactNode, useEffect, useState } from 'react'
import { z } from 'zod'
import { m } from '../../paraglide/messages.js'
import { FormAlert } from '../auth/auth-layout.tsx'
import { actionResult, activateWorkspace, workspaceAction } from './client.ts'
import { roleLabel } from './labels.ts'
import type { getWorkspacePage } from './workspace.functions.ts'

const invitationStatusLabels: Record<string, () => string> = {
  pending: () => m.workspace_invitation_pending(),
  accepted: () => m.workspace_invitation_accepted(),
  rejected: () => m.workspace_invitation_rejected(),
  canceled: () => m.workspace_invitation_canceled(),
}
function invitationStatusLabel(status: string) {
  return invitationStatusLabels[status]?.() ?? status
}

export type WorkspacePage = Awaited<ReturnType<typeof getWorkspacePage>>
export function HydratedControls({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return (
    <fieldset disabled={!hydrated} className="grid min-w-0 gap-4">
      {children}
    </fieldset>
  )
}

export function CreateTeam() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { name: '', slug: '' },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: () => m.workspace_validation_min_characters({ count: 1 }) })
          .max(100, { error: () => m.workspace_validation_max_characters({ count: 100 }) }),
        slug: z
          .string()
          .min(3, { error: () => m.workspace_validation_min_characters({ count: 3 }) })
          .max(64, { error: () => m.workspace_validation_max_characters({ count: 64 }) })
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            error: () => m.workspace_validation_slug_format(),
          }),
      }),
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const team = await workspaceAction(
          'create',
          value,
          z.object({ id: z.string(), slug: z.string() }),
        )
        await activateWorkspace(team)
      } catch (e) {
        setError(e instanceof Error ? e.message : m.workspace_create_failed())
      }
    },
  })
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {m.workspace_create_team_workspace()}
      </Button>
      {open ? (
        <form.AppForm>
          <form.Form aria-label={m.workspace_create_team_workspace()}>
            <FormAlert message={error} />
            <form.AppField name="name">
              {(field) => <field.TextField label={m.workspace_team_name()} />}
            </form.AppField>
            <form.AppField name="slug">
              {(field) => (
                <field.TextField label={m.workspace_url()} description={m.workspace_url_hint()} />
              )}
            </form.AppField>
            <form.SubmitButton pendingLabel={m.workspace_creating()}>
              {m.workspace_create_team()}
            </form.SubmitButton>
          </form.Form>
        </form.AppForm>
      ) : null}
    </>
  )
}

export function WorkspaceSettings({ page }: { page: WorkspacePage }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const seatsFull = page.maxSeats !== null && page.memberCount >= page.maxSeats
  async function run(action: string, body: object) {
    setPending(true)
    setError(null)
    try {
      await workspaceAction(action, { organizationId: page.workspace.id, ...body }, actionResult)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.workspace_update_failed())
      setPending(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.app_workspace_settings()}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p>
          {m.workspace_seats({
            count: page.memberCount,
            limit: page.maxSeats ?? m.workspace_unlimited(),
          })}
        </p>
        {seatsFull ? (
          <p role="status">
            {page.memberCount > (page.maxSeats ?? 0)
              ? m.workspace_seats_exceeded()
              : m.workspace_seats_full()}
          </p>
        ) : null}
        {page.readOnly ? <p role="status">{m.app_readonly()}</p> : null}
        <FormAlert message={error} />
        <HydratedControls>
          <fieldset disabled={pending} className="grid gap-6">
            {page.canManage ? (
              <form
                aria-label={m.workspace_invite_member()}
                onSubmit={(event) => {
                  event.preventDefault()
                  void run('invite-member', { email, role })
                }}
                className="grid gap-3"
              >
                <Label htmlFor="invite-email">{m.workspace_invite_email()}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Label htmlFor="invite-role">{m.workspace_invitation_role()}</Label>
                <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">{m.workspace_option_member()}</option>
                  <option value="admin">{m.workspace_option_admin()}</option>
                </select>
                <Button type="submit" disabled={seatsFull}>
                  {m.workspace_send_invitation()}
                </Button>
              </form>
            ) : null}
            <h2 className="font-semibold">{m.workspace_members()}</h2>
            <ul className="grid gap-4">
              {page.members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3">
                  <span>
                    {member.name} ({member.email}) · {roleLabel(member.role)}
                  </span>
                  {page.canManage && member.role !== 'owner' ? (
                    <>
                      <Label htmlFor={`role-${member.id}`}>
                        {m.workspace_member_role({ name: member.name })}
                      </Label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        onChange={(e) =>
                          void run('update-member-role', {
                            memberId: member.id,
                            role: e.target.value,
                          })
                        }
                      >
                        <option value="member">{m.workspace_option_member()}</option>
                        <option value="admin">{m.workspace_option_admin()}</option>
                      </select>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(m.workspace_remove_confirm({ name: member.name })))
                            void run('remove-member', { memberIdOrEmail: member.id })
                        }}
                      >
                        {m.workspace_remove()}
                      </Button>
                      {page.role === 'owner' ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (window.confirm(m.workspace_transfer_confirm({ name: member.name })))
                              void run('transfer-owner', { memberId: member.id })
                          }}
                        >
                          {m.workspace_transfer_ownership()}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {!page.workspace.isPersonal && page.invitations.length ? (
              <>
                <h2 className="font-semibold">{m.workspace_invitations()}</h2>
                <ul className="grid gap-3">
                  {page.invitations.map((i) => (
                    <li key={i.id}>
                      {i.email} · {roleLabel(i.role ?? '')} · {invitationStatusLabel(i.status)} ·{' '}
                      {m.workspace_invitation_expires({
                        date: new Date(i.expiresAt).toISOString().slice(0, 10),
                      })}{' '}
                      {page.canManage && i.status === 'pending' ? (
                        <Button
                          variant="outline"
                          onClick={() => void run('cancel-invitation', { invitationId: i.id })}
                        >
                          {m.workspace_revoke_invitation()}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </fieldset>
        </HydratedControls>
      </CardContent>
    </Card>
  )
}
