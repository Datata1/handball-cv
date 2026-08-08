import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

import { formatBytes, transferStats } from '../progress'
import { isLargeFile } from '../validation'

/**
 * Byte-level progress for one file, and the way out of it.
 *
 * `processing` is the wait after the last byte: the server reads the whole
 * upload into memory before it answers, so a bar parked at 100% would look
 * hung. It says what is happening instead, and cancelling is no longer
 * possible — the bytes are already there.
 */
export function UploadProgress({
  fileName,
  loaded,
  total,
  elapsedMs,
  phase,
  onCancel,
}: {
  fileName: string
  loaded: number
  total: number
  /** Since the request started — the only input to rate and ETA. */
  elapsedMs: number
  phase: 'uploading' | 'processing'
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation(['upload', 'common'])
  const locale = i18n.language

  const { percent, bytesPerSecond, secondsRemaining } = transferStats(
    loaded,
    total,
    elapsedMs,
  )

  const uploading = phase === 'uploading'

  const remaining =
    secondsRemaining === null
      ? null
      : secondsRemaining >= 60
        ? t('common:units.minutes', { value: Math.ceil(secondsRemaining / 60) })
        : t('common:units.seconds', { value: Math.ceil(secondsRemaining) })

  return (
    <Card className="gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{fileName}</p>
          <p className="text-sm text-muted-foreground" role="status">
            {uploading
              ? t('upload:progress.uploading')
              : t('upload:progress.processing')}
          </p>
        </div>

        {uploading ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X aria-hidden="true" />
            {t('upload:progress.cancel')}
          </Button>
        ) : null}
      </div>

      <Progress
        value={percent}
        aria-label={t('upload:progress.label')}
        aria-valuetext={t('common:units.percent', { value: Math.round(percent) })}
      />

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
        <span>
          {t('upload:progress.transferred', {
            loaded: formatBytes(loaded, locale),
            total: formatBytes(total, locale),
          })}
        </span>

        <span>{t('common:units.percent', { value: Math.round(percent) })}</span>

        {uploading && bytesPerSecond !== null ? (
          <span>
            {t('upload:progress.rate', { rate: formatBytes(bytesPerSecond, locale) })}
          </span>
        ) : null}

        {uploading && remaining !== null ? (
          <span>{t('upload:progress.remaining', { duration: remaining })}</span>
        ) : null}
      </div>

      {phase === 'processing' ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {t('upload:progress.processingHint')}
        </p>
      ) : null}

      {isLargeFile(total) ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {t('upload:progress.largeFile')}
        </p>
      ) : null}
    </Card>
  )
}
