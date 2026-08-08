import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionStub } from '@/features/report/components/SectionStub'
import { defenseSearch } from '@/features/report/search'

export const Route = createFileRoute('/matches/$matchId/defense')({
  validateSearch: defenseSearch,
  component: DefenseSection,
})

function DefenseSection() {
  const { t } = useTranslation('report')

  return <SectionStub title={t('sections.defense')} />
}
