import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  useAppForm,
} from '@xuanxue/ui'
import { type ReactNode, useEffect, useState } from 'react'
import { z } from 'zod'
import { m } from '../../paraglide/messages.js'
import { useAppShellBarAvailable } from '../app-shell/bar.tsx'
import { FormAlert } from '../auth/auth-layout.tsx'
import { actionResult, activateWorkspace, workspaceAction } from './client.ts'
import type { getWorkspacePage } from './workspace.functions.ts'

const roleLabels: Record<string, () => string> = {
  owner: () => m.workspace_role_owner(),
  admin: () => m.workspace_role_admin(),
  member: () => m.workspace_role_member(),
}
const invitationStatusLabels: Record<string, () => string> = {
  pending: () => m.workspace_invitation_pending(),
  accepted: () => m.workspace_invitation_accepted(),
  rejected: () => m.workspace_invitation_rejected(),
  canceled: () => m.workspace_invitation_canceled(),
}
function roleLabel(role: string) {
  return roleLabels[role]?.() ?? role
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

// 模板工作台布局（sidebar / topbar-layout）使用；本项目单空间时返回 null
export function WorkspaceSwitcher({ page }: { page: WorkspacePage }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const spaces = page.spaces.map((space) => ({
    ...space,
    label: `${space.name}${space.isPersonal ? ' (personal)' : ''}`,
  }))
  const currentSpace = spaces.find((space) => space.id === page.workspace.id)
  if (!page.multiTenant) return null
  return (
    <HydratedControls>
      <Label htmlFor="workspace-switcher">Switch workspace</Label>
      <Select
        value={currentSpace?.id ?? ''}
        disabled={pending}
        onValueChange={async (value) => {
          const space = spaces.find((s) => s.id === value)
          if (!space) return
          setPending(true)
          setError(null)
          try {
            await activateWorkspace(space)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not switch workspace.')
            setPending(false)
          }
        }}
      >
        <SelectTrigger
          id="workspace-switcher"
          className="w-full"
          placeholder="Switch workspace"
          valueLabel={currentSpace?.label}
        />
        <SelectContent>
          {spaces.map((space, index) => (
            <SelectItem key={space.id} index={index} value={space.id}>
              {space.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormAlert message={error} />
      <CreateTeam />
    </HydratedControls>
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

function memberRoleOptions() {
  return [
    { value: 'member', label: m.workspace_option_member() },
    { value: 'admin', label: m.workspace_option_admin() },
  ]
}

type ConfirmationTarget = {
  action: 'remove' | 'transfer'
  item: WorkspacePage['members'][number]
}

export function WorkspaceSettings({ page }: { page: WorkspacePage }) {
  const inShell = useAppShellBarAvailable()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmationTarget | null>(null)
  const memberRoles = memberRoleOptions()
  const invitationRole = memberRoles.find((option) => option.value === role)
  const confirmCopy =
    confirmTarget?.action === 'transfer'
      ? {
          title: m.workspace_transfer_confirm_title(),
          description: m.workspace_transfer_confirm_description({ name: confirmTarget.item.name }),
          action: m.workspace_transfer_ownership(),
          variant: 'default' as const,
        }
      : {
          title: m.workspace_remove_confirm_title(),
          description: m.workspace_remove_confirm_description({
            name: confirmTarget?.item.name ?? '',
          }),
          action: m.workspace_remove(),
          variant: 'destructive' as const,
        }
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
  async function confirmAction() {
    if (!confirmTarget || pending) return
    const { action, item } = confirmTarget
    if (action === 'remove') await run('remove-member', { memberIdOrEmail: item.id })
    else await run('transfer-owner', { memberId: item.id })
    setConfirmOpen(false)
  }
  return (
    <Card>
      {/* 工作台顶部条已显示「空间设置」标题（h1），不再重复 */}
      {inShell ? null : (
        <CardHeader>
          <CardTitle>{m.app_workspace_settings()}</CardTitle>
        </CardHeader>
      )}
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
                <Select
                  value={invitationRole?.value ?? ''}
                  disabled={pending}
                  onValueChange={setRole}
                >
                  <SelectTrigger
                    id="invite-role"
                    className="w-full"
                    placeholder={m.workspace_invitation_role()}
                    valueLabel={invitationRole?.label}
                  />
                  <SelectContent>
                    {memberRoles.map((option, index) => (
                      <SelectItem key={option.value} index={index} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={seatsFull}>
                  {m.workspace_send_invitation()}
                </Button>
              </form>
            ) : null}
            <h2 className="font-semibold">{m.workspace_members()}</h2>
            <ul className="grid gap-4">
              {page.members.map((member) => {
                const selectedRole = memberRoles.find((option) => option.value === member.role)
                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {member.name} ({member.email}) · {roleLabel(member.role)}
                    </span>
                    {page.canManage && member.role !== 'owner' ? (
                      <>
                        <Label htmlFor={`role-${member.id}`}>
                          {m.workspace_member_role({ name: member.name })}
                        </Label>
                        <Select
                          value={selectedRole?.value ?? ''}
                          disabled={pending}
                          onValueChange={(value) =>
                            void run('update-member-role', { memberId: member.id, role: value })
                          }
                        >
                          <SelectTrigger
                            id={`role-${member.id}`}
                            className="w-full"
                            placeholder={m.workspace_member_role({ name: member.name })}
                            valueLabel={selectedRole?.label}
                          />
                          <SelectContent>
                            {memberRoles.map((option, index) => (
                              <SelectItem key={option.value} index={index} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setConfirmTarget({ action: 'remove', item: member })
                            setConfirmOpen(true)
                          }}
                        >
                          {m.workspace_remove()}
                        </Button>
                        {page.role === 'owner' ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setConfirmTarget({ action: 'transfer', item: member })
                              setConfirmOpen(true)
                            }}
                          >
                            {m.workspace_transfer_ownership()}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </li>
                )
              })}
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
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmCopy.variant}
              loading={pending}
              onClick={(event) => {
                event.preventDefault()
                void confirmAction()
              }}
            >
              {confirmCopy.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
