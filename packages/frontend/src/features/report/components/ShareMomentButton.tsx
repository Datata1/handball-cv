import { Link2 } from 'lucide-react'
import { computed } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatClock } from '@/shared/video'
import { usePlayer } from '@/stores'

/**
 * Writes the playhead into `?at=`, which is the only thing that ever does.
 *
 * The position is rounded to a whole second through a computed, so this
 * re-renders once a second instead of once a frame — and so the URL a trainer
 * copies stays readable.
 */
export const ShareMomentButton = observer(function ShareMomentButton({
  onShare,
}: {
  onShare: (seconds: number) => void
}) {
  const { t } = useTranslation('report')
  const player = usePlayer()

  const second = useMemo(() => computed(() => Math.floor(player.currentTime)), [player])

  const at = second.get()

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onShare(at)}>
      <Link2 aria-hidden="true" />
      {t('moment.action')}
      <span aria-hidden="true" className="tabular-nums text-muted-foreground">
        {formatClock(at)}
      </span>
    </Button>
  )
})
