import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import { cn } from '@/lib/utils'
import type { NormalisedTeam } from '@/shared/api'

import {
  TEAM_BUCKETS,
  teamShare,
  tileFill,
  tileFillStyle,
  type ZoneTileData,
} from '../tiles'

/** The team colours the timeline already uses for the same three buckets. */
const TEAM_TONES: Record<NormalisedTeam, string> = {
  A: 'bg-chart-1',
  B: 'bg-chart-2',
  U: 'bg-muted-foreground',
}

/**
 * One zone, carrying both of the things `/stats` reports about it: how busy it
 * was relative to the rest of the half, and who was in it.
 *
 * The fill is on the value alone. It runs the whole ramp — a strong zone is
 * meant to look like one — and only large text can survive that, so the zone's
 * name and its counts stay on the card where the ramp cannot reach them. Colour
 * carries nothing on its own either way: every number beside it is written out.
 */
export function ZoneTile({
  tile,
  label,
  teamName,
}: {
  tile: ZoneTileData
  /** The zone's name, looked up by the caller — the codes are backend labels. */
  label: string
  teamName: TeamName
}) {
  const { t } = useTranslation('heatmap')
  const fill = tileFill(tile.intensity)

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <p
        style={tileFillStyle(fill)}
        className={cn(
          'px-3 py-4 text-center font-bold text-2xl tabular-nums',
          fill.inverted ? 'text-primary-foreground' : 'text-card-foreground',
        )}
      >
        {t('tiles.intensity', { value: Math.round(tile.intensity) })}
      </p>

      <div className="space-y-2 px-3 py-3">
        <p className="font-medium text-sm">{label}</p>

        {tile.total === 0 ? (
          <p className="text-muted-foreground text-xs">{t('tiles.silent')}</p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              {TEAM_BUCKETS.map((team) => (
                <div
                  key={team}
                  className={TEAM_TONES[team]}
                  style={{ inlineSize: `${teamShare(tile, team) * 100}%` }}
                />
              ))}
            </div>

            <ul className="space-y-0.5 text-muted-foreground text-xs">
              {TEAM_BUCKETS.filter((team) => tile.counts[team] > 0).map((team) => (
                <li key={team} className="truncate tabular-nums">
                  {t('tiles.share', {
                    team: teamName(team),
                    count: tile.counts[team],
                  })}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  )
}
