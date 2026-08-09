import { computed } from 'mobx'
import { observer } from 'mobx-react-lite'
import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { TeamPhase } from '@/shared/api'
import { usePlayer } from '@/stores'

import { phaseAt } from '../phases'
import type { TeamName } from '../teams'

/**
 * Who is attacking at the moment on screen.
 *
 * The playhead moves several times a second and this is the only thing in the
 * shell that reads it, so it is its own `observer` — and what it observes is a
 * *computed*, so a frame that does not change the phase re-renders nothing at
 * all.
 */
export const ActivePhaseBadge = observer(function ActivePhaseBadge({
  phases,
  teamName,
}: {
  phases: readonly TeamPhase[]
  teamName: TeamName
}) {
  const { t } = useTranslation('report')
  const player = usePlayer()

  const active = useMemo(
    () => computed(() => phaseAt(phases, player.currentTime)),
    [phases, player],
  )

  if (phases.length === 0) return null

  const phase = active.get()

  if (phase === null) {
    return <Pill>{t('phase.transition')}</Pill>
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Pill>
        {t('phase.offense')}: {teamName(phase.offense_team)}
      </Pill>
      <Pill>
        {t('phase.defense')}: {teamName(phase.defense_team)}
      </Pill>
    </span>
  )
})

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
      {children}
    </span>
  )
}
