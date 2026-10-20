import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalRouteOptions } from '../features/marketing/legal-page.tsx'

export const Route = createFileRoute('/terms')({
  ...legalRouteOptions('terms'),
  component: () => <LegalPage page={Route.useLoaderData()} />,
})
