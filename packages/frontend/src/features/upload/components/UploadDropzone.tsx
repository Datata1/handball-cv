import { CloudUpload } from 'lucide-react'
import { type DragEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { ACCEPTED_FILE_TYPES } from '../validation'

/**
 * The file picker, which is also the drop target.
 *
 * A real `<input type="file">` inside the label, visually hidden but focusable
 * — so Tab reaches it, Enter and Space open the picker, and the zone shows a
 * focus ring through `has-[…]`. A div with a click handler, which is what the
 * legacy zone was, has none of that.
 */
export function UploadDropzone({
  onSelect,
  defaultDragging = false,
}: {
  onSelect: (file: File) => void
  /** Stories only: shows the drag-over state without a real drag. */
  defaultDragging?: boolean
}) {
  const { t } = useTranslation('upload')
  const inputId = useId()
  const [dragging, setDragging] = useState(defaultDragging)

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)

    // The first file, whatever its MIME type: browsers report `.mkv` as an
    // empty type, so filtering on `video/` here would silently drop it.
    // Validation happens in one place, after selection.
    const file = event.dataTransfer.files[0]
    if (file) onSelect(file)
  }

  return (
    <Card
      className={cn(
        'border-2 border-dashed p-0 shadow-none transition-colors',
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
        dragging ? 'border-primary bg-accent' : 'border-input',
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center gap-4 px-6 py-12 text-center"
      >
        <CloudUpload
          aria-hidden="true"
          className={cn('size-10', dragging ? 'text-primary' : 'text-muted-foreground')}
        />

        <span className="font-medium">
          {dragging ? t('dropzone.dropHint') : t('dropzone.hint')}
        </span>

        <span className="text-sm text-muted-foreground">{t('dropzone.formats')}</span>

        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onSelect(file)
            // Clear it, so re-picking the same file after a rejection still
            // fires `change`.
            event.target.value = ''
          }}
        />
      </label>
    </Card>
  )
}
