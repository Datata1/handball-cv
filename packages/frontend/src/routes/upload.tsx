import { createFileRoute } from '@tanstack/react-router'
import { Hammer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState, PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/upload')({
  component: UploadRoute,
})

function UploadRoute() {
  const { t } = useTranslation(['common', 'upload'])

  return (
    <>
      <PageHeader title={t('upload:title')} />

      <EmptyState
        icon={<Hammer />}
        title={t('stub.title')}
        description={t('stub.description')}
      />
    </>
  )
}
