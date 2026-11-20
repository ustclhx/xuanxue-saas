import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '../features/marketing/legal-page.tsx'
import { legalRouteOptions } from '../features/marketing/legal-route.ts'

export const Route = createFileRoute('/refund')({
  ...legalRouteOptions('refund'),
  component: () => <LegalPage page={Route.useLoaderData()} />,
})
