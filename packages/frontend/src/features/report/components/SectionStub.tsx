import { Hammer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState, Section } from '@/shared/ui'

/**
 * A section that has its URL but not its content yet. Scaffolding: each of
 * PRs 14–18 replaces one of these with the real section.
 */
export function SectionStub({ title }: { title: string }) {
  const { t } = useTranslation()

  return (
    <Section title={title}>
      <EmptyState
        icon={<Hammer />}
        title={t('stub.title')}
        description={t('stub.description')}
      />
    </Section>
  )
}
