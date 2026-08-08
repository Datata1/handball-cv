import { Search } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

import type { SortKey } from '../search'

/** Search and sort over the fetched list — this API has neither server-side. */
export function MatchFilters({
  query,
  sort,
  onQueryChange,
  onSortChange,
}: {
  query: string
  sort: SortKey
  onQueryChange: (query: string) => void
  onSortChange: (sort: SortKey) => void
}) {
  const { t } = useTranslation('dashboard')
  const searchId = useId()
  const sortId = useId()

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Label htmlFor={searchId} className="sr-only">
          {t('filters.search')}
        </Label>

        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />

        <Input
          id={searchId}
          type="search"
          value={query}
          placeholder={t('filters.searchPlaceholder')}
          onChange={(event) => onQueryChange(event.target.value)}
          className="ps-9"
        />
      </div>

      <div className="sm:w-56">
        <Label htmlFor={sortId} className="sr-only">
          {t('filters.sort')}
        </Label>

        <NativeSelect
          id={sortId}
          value={sort}
          onChange={(event) =>
            onSortChange(event.target.value === 'name' ? 'name' : 'recent')
          }
        >
          <option value="recent">{t('filters.sortRecent')}</option>
          <option value="name">{t('filters.sortName')}</option>
        </NativeSelect>
      </div>
    </div>
  )
}
