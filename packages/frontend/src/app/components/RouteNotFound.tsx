import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/shared/ui'

/** An address that belongs to no route — and the way back to one that does. */
export function RouteNotFound() {
  const { t } = useTranslation()

  return (
    <PageHeader
      title={t('notFound.title')}
      description={t('notFound.description')}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/">{t('notFound.action')}</Link>
        </Button>
      }
    />
  )
}
