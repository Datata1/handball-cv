import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { PlayerStat } from '@/shared/api'
import { type Column, DataTable } from '@/shared/ui'

import {
  isTrackSortKey,
  TRACK_LIMIT,
  type TrackSort,
  type TrackSortKey,
  teamBucket,
} from '../tracks'

/**
 * The tracking diagnostics, one row per track.
 *
 * Column ids are the sort keys the URL carries, so the header a trainer pressed
 * and the `?sort=` they can send someone are the same name.
 */
export function TrackTable({
  tracks,
  sort,
  onSort,
  teamName,
  empty,
}: {
  tracks: readonly PlayerStat[]
  sort: TrackSort
  onSort: (key: TrackSortKey) => void
  teamName: TeamName
  /** Shown in place of the rows — a filter that matched nothing, not no data. */
  empty?: string
}) {
  const { t, i18n } = useTranslation('players')
  const { t: tCommon } = useTranslation()

  const count = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 })
  const decimal = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  const columns: Column<PlayerStat>[] = [
    {
      id: 'track',
      header: t('columns.track'),
      sortable: true,
      cell: (track) => t('cells.track', { id: track.track_id }),
    },
    {
      id: 'team',
      header: t('columns.team'),
      sortable: true,
      cell: (track) => teamName(teamBucket(track.team)),
    },
    {
      id: 'frames',
      header: t('columns.frames'),
      numeric: true,
      sortable: true,
      cell: (track) => count.format(track.frame_count),
    },
    {
      id: 'confidence',
      header: t('columns.confidence'),
      numeric: true,
      sortable: true,
      cell: (track) =>
        tCommon('units.percent', { value: decimal.format(track.avg_confidence_pct) }),
    },
    {
      id: 'distance',
      header: t('columns.distance'),
      numeric: true,
      sortable: true,
      cell: (track) =>
        tCommon('units.metres', { value: decimal.format(track.distance_m) }),
    },
  ]

  return (
    <DataTable<PlayerStat>
      caption={t('table.caption', { limit: TRACK_LIMIT })}
      columns={columns}
      rows={[...tracks]}
      getRowId={(track) => String(track.track_id)}
      sort={{
        columnId: sort.key,
        direction: sort.direction,
        onSort: (columnId) => {
          if (isTrackSortKey(columnId)) onSort(columnId)
        },
      }}
      empty={empty}
    />
  )
}
