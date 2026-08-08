import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/matches/$matchId/')({
  // `replace`, so back from the overview leaves the report rather than
  // bouncing through the redirect again.
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/matches/$matchId/overview', params, replace: true })
  },
})
