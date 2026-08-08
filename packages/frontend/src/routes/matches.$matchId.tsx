import { createFileRoute, Outlet, retainSearchParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionNav } from '@/features/report/components/SectionNav'
import { reportSearch } from '@/features/report/search'
import { PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/matches/$matchId')({
  validateSearch: reportSearch,
  // The playhead belongs to the match, not to a section, so it survives moving
  // between them. Section filters deliberately do not.
  search: { middlewares: [retainSearchParams(['at'])] },
  component: ReportLayout,
})

// PR 13 replaces the header with the editable match names and mounts the
// shared player and timeline here, above the Outlet.
function ReportLayout() {
  const { matchId } = Route.useParams()
  const { t } = useTranslation('report')

  return (
    <>
      <PageHeader title={t('title')} description={matchId} />

      <SectionNav matchId={matchId} />

      <Outlet />
    </>
  )
}
