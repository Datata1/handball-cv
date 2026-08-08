import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { UploadPanel } from '@/features/upload/components/UploadPanel'
import { useVideoUpload } from '@/features/upload/queries'
import { PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/upload')({
  component: UploadRoute,
})

function UploadRoute() {
  const { t } = useTranslation('upload')
  const navigate = Route.useNavigate()
  const [annotate, setAnnotate] = useState(false)

  // Straight to the dashboard rather than to the new match: the match page has
  // nothing to show for minutes, and `GET /matches` already lists it as a
  // processing stub that SSE then keeps current.
  const upload = useVideoUpload({ onUploaded: () => void navigate({ to: '/' }) })

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />

      <UploadPanel
        status={upload.status}
        annotate={annotate}
        onAnnotateChange={setAnnotate}
        onSelect={(file) => upload.start(file, annotate)}
        onCancel={upload.cancel}
      />
    </>
  )
}
