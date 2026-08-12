import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchMeta, MatchStatus } from '@/shared/api'

import { type AnnouncedStatus, statusChanges, statusesById } from '../announce'

/**
 * Says what the push channel changed while nobody was looking at it.
 *
 * A status arrives without any user action — the ingestion finishes, the SSE
 * bridge refetches the list, a card's badge changes — so on screen it is a
 * silent repaint. Politely, because a trainer reading a card should finish the
 * sentence they are on first.
 */
export function StatusAnnouncer({
  matches,
}: {
  /** `undefined` while the list is loading. */
  matches: readonly MatchMeta[] | undefined
}) {
  const { t } = useTranslation('dashboard')
  const [message, setMessage] = useState('')
  const seen = useRef<ReadonlyMap<string, MatchStatus> | null>(null)

  useEffect(() => {
    if (matches === undefined) return

    const previous = seen.current
    seen.current = statusesById(matches)

    // The first list is the page arriving, not something happening on it.
    if (previous === null) return

    const sentence: Record<AnnouncedStatus, (title: string) => string> = {
      processing: (title) => t('announce.processing', { title }),
      done: (title) => t('announce.done', { title }),
      failed: (title) => t('announce.failed', { title }),
    }

    const changes = statusChanges(previous, matches)
    if (changes.length === 0) return

    setMessage(changes.map((change) => sentence[change.status](change.title)).join(' '))
  }, [matches, t])

  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  )
}
