import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '../features/marketing/legal-page.tsx'
import { legalRouteOptions } from '../features/marketing/legal-route.ts'

export const Route = createFileRoute('/disclaimer')({
  ...legalRouteOptions('disclaimer'),
  component: () => <LegalPage page={Route.useLoaderData()} />,
})
