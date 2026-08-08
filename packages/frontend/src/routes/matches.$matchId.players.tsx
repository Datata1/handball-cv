import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionStub } from '@/features/report/components/SectionStub'

export const Route = createFileRoute('/matches/$matchId/players')({
  component: PlayersSection,
})

function PlayersSection() {
  const { t } = useTranslation('report')

  return <SectionStub title={t('sections.players')} />
}
