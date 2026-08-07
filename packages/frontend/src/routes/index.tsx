import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/')({
  component: Home,
})

// Exported for index.stories.tsx — rendering it needs no router context.
export function Home() {
  const { t } = useTranslation('dashboard')

  return (
    <section>
      <h1 className="text-3xl font-bold text-primary">{t('title')}</h1>
      <p className="mt-1 text-muted-foreground">{t('tagline')}</p>

      <div className="mt-8 rounded-lg border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">{t('empty.title')}</h2>
        <p className="mt-1 text-muted-foreground">{t('empty.description')}</p>
      </div>
    </section>
  )
}
