import { createFileRoute, Link } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DashboardSummary } from '@/features/dashboard/components/DashboardSummary'
import { MatchFilters } from '@/features/dashboard/components/MatchFilters'
import { MatchList } from '@/features/dashboard/components/MatchList'
import {
  filterMatches,
  sortMatches,
  summariseMatches,
} from '@/features/dashboard/matches'
import {
  useMatches,
  useMatchMutations,
  useMatchScores,
} from '@/features/dashboard/queries'
import { dashboardSearch, type SortKey } from '@/features/dashboard/search'
import { PageHeader, Section } from '@/shared/ui'

export const Route = createFileRoute('/')({
  validateSearch: dashboardSearch,
  component: Dashboard,
})

function Dashboard() {
  const { q, sort } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t, i18n } = useTranslation('dashboard')

  const matches = useMatches()
  const scores = useMatchScores(matches.data ?? [])
  const mutations = useMatchMutations()

  const visible = useMemo(
    () =>
      matches.data
        ? sortMatches(filterMatches(matches.data, q), sort, i18n.language)
        : undefined,
    [matches.data, q, sort, i18n.language],
  )

  const summary = useMemo(() => summariseMatches(matches.data ?? []), [matches.data])

  // Replace rather than push: a search is refined keystroke by keystroke, and
  // each one would otherwise be a back-button step. An emptied search drops
  // `?q=` rather than carrying a blank one.
  function setSearch(next: { q?: string; sort?: SortKey }) {
    void navigate({
      search: (current) => ({
        q: (next.q ?? current.q)?.trim() || undefined,
        sort: next.sort ?? current.sort,
      }),
      replace: true,
    })
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('tagline')}
        actions={
          <Button asChild>
            <Link to="/upload">
              <Upload aria-hidden="true" />
              {t('newUpload')}
            </Link>
          </Button>
        }
      />

      <DashboardSummary summary={summary} />

      <Section title={t('list.title')}>
        <MatchFilters
          query={q ?? ''}
          sort={sort}
          onQueryChange={(value) => setSearch({ q: value })}
          onSortChange={(value) => setSearch({ sort: value })}
        />

        <MatchList
          matches={visible}
          scores={scores}
          mutations={mutations}
          error={matches.error}
          searching={q !== undefined}
          onRetry={() => void matches.refetch()}
        />
      </Section>
    </>
  )
}
