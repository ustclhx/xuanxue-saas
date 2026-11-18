import { createFileRoute, notFound } from '@tanstack/react-router'
import { Prose, Section, SectionStack } from '@xuanxue/ui/project'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { AiDisclaimer, Disclaimer } from '../../features/tools/disclaimer.tsx'

// 站点外壳与区块容器的演示（openspec refresh-visual-system-warm 4.2、4.3），只在本地开发服务器可用：
// 页头（工具下拉、手机导航面板）、页脚（设置行、合规声明）、Section（素色 / 色带）与 Prose 的节奏。
// 东方站：`http://east.localhost:<WEB_PORT>/zh-hant/dev/shell`；西方站：`/dev/shell`。
// 演示文案不进入 messages；对照设计稿 docs/design/prototypes/warm-refresh/Components*.dc.html。
export const Route = createFileRoute('/dev/shell')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({
    meta: [{ title: 'Site shell demo' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ShellDemoPage,
})

function ShellDemoPage() {
  return (
    <MarketingShell>
      <SectionStack className="pt-10">
        <Section
          id="demo-plain"
          title="Section · plain"
          intro="標題到內容 40px（手機 32px），標題與說明限寬 720px；區塊之間 112px（手機 64px）。"
        >
          <Prose>
            <p className="m-0">
              正文寬度不超過
              720px：填寫出生日期、時辰與出生地，不需要註冊。四柱、十神、五行、大運與神煞，全部免費。
            </p>
            <p className="m-0">
              Running text never exceeds 720px. Enter your birth date; no sign-up needed. See your
              Life Path number with every reduction step shown.
            </p>
          </Prose>
        </Section>
        <Section id="demo-band" tone="band" aria-label="Section · band">
          <p className="m-0 text-body text-ink">
            Section · band：surface-2 圓角色帶，一行文字加一個文字連結；手機上下排列。
          </p>
          <a href="#demo-plain" className="inline-flex min-h-11 items-center text-brand-ink">
            回到上方 →
          </a>
        </Section>
        <Section id="demo-disclaimer" title="合規聲明（caption 小字）">
          <div className="flex flex-col gap-3">
            <Disclaimer />
            <AiDisclaimer />
          </div>
        </Section>
      </SectionStack>
    </MarketingShell>
  )
}
