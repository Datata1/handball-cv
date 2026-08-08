import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { apiErrorKey } from '@/shared/api'
import { InlineError } from '@/shared/ui'

import type { UploadStatus } from '../queries'
import { extensionOf } from '../validation'
import { UploadDropzone } from './UploadDropzone'
import { UploadProgress } from './UploadProgress'

/**
 * The whole upload view, driven by one status value — every state a file can be
 * in is a prop, so each of them is a story.
 */
export function UploadPanel({
  status,
  annotate,
  onAnnotateChange,
  onSelect,
  onCancel,
}: {
  status: UploadStatus
  annotate: boolean
  onAnnotateChange: (annotate: boolean) => void
  onSelect: (file: File) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('upload')
  const { t: tCommon } = useTranslation()
  const annotateId = useId()
  const annotateHintId = useId()

  if (status.phase === 'uploading' || status.phase === 'processing') {
    return (
      <UploadProgress
        fileName={status.fileName}
        loaded={status.phase === 'uploading' ? status.loaded : status.total}
        total={status.total}
        elapsedMs={status.phase === 'uploading' ? status.elapsedMs : 0}
        phase={status.phase}
        onCancel={onCancel}
      />
    )
  }

  return (
    <div className="space-y-6">
      <UploadDropzone onSelect={onSelect} />

      {status.phase === 'rejected' ? (
        <InlineError>
          {status.reason === 'unsupportedFormat'
            ? t('errors.unsupportedFormat', { extension: extensionOf(status.fileName) })
            : t('errors.missingExtension', { fileName: status.fileName })}
        </InlineError>
      ) : null}

      {status.phase === 'failed' ? (
        <InlineError>
          {t('errors.failed')} {tCommon(apiErrorKey(status.error))}
        </InlineError>
      ) : null}

      {status.phase === 'cancelled' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('cancelled', { fileName: status.fileName })}
        </p>
      ) : null}

      <div className="flex items-start gap-3">
        <Checkbox
          id={annotateId}
          checked={annotate}
          onCheckedChange={(checked) => onAnnotateChange(checked === true)}
          aria-describedby={annotateHintId}
        />

        <div className="space-y-1">
          <Label htmlFor={annotateId} className="font-normal">
            {t('annotate.label')}
          </Label>

          <p id={annotateHintId} className="text-sm text-muted-foreground text-pretty">
            {t('annotate.hint')}
          </p>
        </div>
      </div>
    </div>
  )
}
