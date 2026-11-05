import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { getChatAvailable } from '../../../features/ai/model-picker.functions.ts'
import { spaceSections } from '../../../features/app-shell/space-frame.tsx'
import { SiteHeader } from '../../../features/marketing/site-header.tsx'
import { NotificationCenter } from '../../../features/notifications/center.tsx'
import { getWorkspacePage } from '../../../features/workspace/workspace.functions.ts'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'

export const Route = createFileRoute('/app/$slug')({
  beforeLoad: async ({ params }) => {
    const [workspacePage, chatAvailable] = await Promise.all([
      getWorkspacePage({ data: { slug: params.slug } }),
      // 对话入口只在空间有可用模型时显示；读取失败按不可用处理，不影响其他页面
      templateConfig.ai.text.enabled
        ? getChatAvailable({ data: { slug: params.slug } }).catch(() => false)
        : false,
    ])
    return { workspacePage, chatAvailable }
  },
  loader: ({ context }) => ({ ...context.workspacePage, chatAvailable: context.chatAvailable }),
  staleTime: 0,
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.workspace.name} · Workspace` }] : [],
  }),
  component: WorkspaceLayout,
  notFoundComponent: () => (
    <main>
      <h1>{m.app_workspace_not_found()}</h1>
      <p>{m.app_workspace_no_access()}</p>
      <a href="/app">{m.app_go_workspace()}</a>
    </main>
  ),
})

// 导航项的激活态：当前分区用品牌色下划线与加粗标出，其余为弱化文字
const navItemClass =
  'flex min-h-11 items-center rounded-lg px-3 text-[15px] transition-colors hover:bg-surface-2 hover:text-ink'
const activeProps = {
  className: `${navItemClass} bg-surface-2 font-semibold text-ink`,
  'aria-current': 'page' as const,
}
const inactiveProps = { className: `${navItemClass} text-ink-muted` }

function WorkspaceLayout() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  const canManageKeys = page.role === 'owner' || page.role === 'admin'
  const sections = spaceSections({
    billing: templateConfig.billing.enabled,
    credits: templateConfig.credits.enabled,
    textAi: templateConfig.ai.text.enabled,
    chatAvailable: page.chatAvailable,
    mediaAi: Boolean(templateConfig.ai.image || templateConfig.ai.video),
    publicApi: templateConfig.features.publicApi,
    canManageKeys,
  })
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-[1120px] flex-1 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="grid content-start gap-6">
          <section
            aria-labelledby="space-summary"
            className="grid gap-2 rounded-xl border border-line bg-surface p-4"
          >
            <h2
              id="space-summary"
              data-testid="workspace-name"
              className="m-0 font-semibold text-ink text-base"
            >
              {page.workspace.name}
            </h2>
            <p className="m-0 text-ink-subtle text-sm">
              {page.workspace.isPersonal ? m.app_personal_workspace() : m.app_team_workspace()}
              {' · '}
              {m.app_role({ role: page.role })}
            </p>
            <p data-testid="current-user" className="m-0 break-all text-ink-muted text-sm">
              {page.user.name} ({page.user.email})
            </p>
            {page.readOnly ? (
              <p role="status" className="m-0 text-ink-muted text-sm">
                {m.app_readonly()}
              </p>
            ) : null}
            <NotificationCenter key={page.workspace.slug} slug={page.workspace.slug} />
          </section>
          <nav aria-label={m.app_nav_label()} className="grid gap-1">
            <Link
              to="/app/$slug"
              params={{ slug }}
              activeOptions={{ exact: true }}
              activeProps={activeProps}
              inactiveProps={inactiveProps}
            >
              {m.app_nav_overview()}
            </Link>
            {sections.readings ? (
              <Link
                to="/app/$slug/readings"
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                {m.readings_list_title()}
              </Link>
            ) : null}
            {sections.chat ? (
              <Link
                to="/app/$slug/chat"
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                {m.app_chat()}
              </Link>
            ) : null}
            {sections.tasks ? (
              <Link
                to="/app/$slug/tasks"
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                {m.media_tasks_title()}
              </Link>
            ) : null}
            {sections.media ? (
              <Link
                to="/app/$slug/media/new"
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                {m.media_title()}
              </Link>
            ) : null}
            {sections.usage ? (
              <Link
                to="/app/$slug/usage"
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                {m.app_usage()}
              </Link>
            ) : null}
            {sections.billing ? (
              <Link
                to="/app/$slug/billing"
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                {m.app_billing()}
              </Link>
            ) : null}
            {sections.apiKeys ? (
              <Link
                to="/app/$slug/api-keys"
                search={{ page: 0 }}
                params={{ slug }}
                activeProps={activeProps}
                inactiveProps={inactiveProps}
              >
                API Keys
              </Link>
            ) : null}
            <Link
              to="/app/$slug/settings"
              params={{ slug }}
              activeProps={activeProps}
              inactiveProps={inactiveProps}
            >
              {m.app_workspace_settings()}
            </Link>
          </nav>
        </aside>
        <main id="main" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
