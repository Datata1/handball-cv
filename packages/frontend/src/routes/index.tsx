import { createFileRoute } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState, PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/')({
  component: Home,
})

// Exported for index.stories.tsx — rendering it needs no router context.
export function Home() {
  const { t } = useTranslation('dashboard')

  return (
    <>
      <PageHeader title={t('title')} description={t('tagline')} />

      <EmptyState
        icon={<Inbox />}
        title={t('empty.title')}
        description={t('empty.description')}
      />
    </>
  )
}
