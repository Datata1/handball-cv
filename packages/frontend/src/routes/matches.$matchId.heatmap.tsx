import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionStub } from '@/features/report/components/SectionStub'
import { heatmapDefaults, heatmapSearch } from '@/features/report/search'

export const Route = createFileRoute('/matches/$matchId/heatmap')({
  validateSearch: heatmapSearch,
  search: { middlewares: [stripSearchParams(heatmapDefaults)] },
  component: HeatmapSection,
})

function HeatmapSection() {
  const { t } = useTranslation('report')

  return <SectionStub title={t('sections.heatmap')} />
}
