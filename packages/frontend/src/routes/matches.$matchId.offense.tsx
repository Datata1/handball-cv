import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionStub } from '@/features/report/components/SectionStub'
import { offenseSearch } from '@/features/report/search'

export const Route = createFileRoute('/matches/$matchId/offense')({
  validateSearch: offenseSearch,
  component: OffenseSection,
})

function OffenseSection() {
  const { t } = useTranslation('report')

  return <SectionStub title={t('sections.offense')} />
}
