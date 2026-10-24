import { createFileRoute, Link } from '@tanstack/react-router'
import { SpacePage, SpacePanel, spaceSections } from '../../../features/app-shell/space-frame.tsx'
import { CreateTeam, HydratedControls } from '../../../features/workspace/components.tsx'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'

export const Route = createFileRoute('/app/$slug/')({
  component: SpaceOverviewPage,
})

/** 空间概览：进入空间后的第一屏，列出快捷入口；团队空间的创建入口也放在这里 */
function SpaceOverviewPage() {
  const { workspacePage: page } = Route.useRouteContext()
  const { slug } = Route.useParams()
  const sections = spaceSections({
    billing: templateConfig.billing.enabled,
    credits: templateConfig.credits.enabled,
    textAi: templateConfig.ai.text.enabled,
    mediaAi: Boolean(templateConfig.ai.image || templateConfig.ai.video),
    publicApi: templateConfig.features.publicApi,
    canManageKeys: page.role === 'owner' || page.role === 'admin',
  })
  const candidates = [
    { show: sections.readings, to: '/app/$slug/readings', label: m.readings_list_title() },
    { show: sections.chat, to: '/app/$slug/chat', label: m.app_chat() },
    { show: sections.tasks, to: '/app/$slug/tasks', label: m.media_tasks_title() },
    { show: sections.usage, to: '/app/$slug/usage', label: m.app_usage() },
    { show: sections.billing, to: '/app/$slug/billing', label: m.app_billing() },
    { show: true, to: '/app/$slug/settings', label: m.app_workspace_settings() },
  ] as const
  const shortcuts = candidates.filter((item) => item.show)
  return (
    <SpacePage
      title={page.workspace.name}
      description={page.workspace.isPersonal ? m.app_personal_workspace() : m.app_team_workspace()}
    >
      <SpacePanel title={m.app_overview_quick()}>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {shortcuts.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                params={{ slug }}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-background px-4 font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                {item.label}
                <span aria-hidden="true" className="text-ink-subtle">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SpacePanel>
      {page.multiTenant ? (
        <SpacePanel title={m.app_team_spaces()}>
          <p className="m-0 text-ink-muted text-sm">{m.app_team_spaces_note()}</p>
          <HydratedControls>
            <CreateTeam />
          </HydratedControls>
        </SpacePanel>
      ) : null}
    </SpacePage>
  )
}
