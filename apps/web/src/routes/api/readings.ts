import { createFileRoute } from '@tanstack/react-router'
import { handleReadingRequest } from '../../features/readings/generate.ts'
import { getReadingHttpDeps } from '../../features/readings/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'

export const Route = createFileRoute('/api/readings')({
  server: {
    handlers: {
      POST: ({ request }) => {
        if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled)
          return new Response('Not Found', { status: 404 })
        return handleReadingRequest(request, getReadingHttpDeps())
      },
    },
  },
})
