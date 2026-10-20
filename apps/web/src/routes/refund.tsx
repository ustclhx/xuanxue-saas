import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalRouteOptions } from '../features/marketing/legal-page.tsx'

export const Route = createFileRoute('/refund')({
  ...legalRouteOptions('refund'),
  component: () => <LegalPage page={Route.useLoaderData()} />,
})
