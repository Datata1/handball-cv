import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'

import { type UploadResult, uploadVideo } from '@/shared/api'
import { qk } from '@/shared/query'

import { rejectFile, type UploadRejection } from './validation'

/**
 * Everything the upload view renders, as one value.
 *
 * `processing` is not a pipeline state — it is the gap between the last byte
 * leaving the browser and the response arriving, which on this backend is a
 * full read of the file into memory and can take a while on a large video.
 */
export type UploadStatus =
  | { phase: 'idle' }
  | { phase: 'rejected'; fileName: string; reason: UploadRejection }
  | {
      phase: 'uploading'
      fileName: string
      loaded: number
      total: number
      elapsedMs: number
    }
  | { phase: 'processing'; fileName: string; total: number }
  | { phase: 'cancelled'; fileName: string }
  | { phase: 'failed'; fileName: string; error: unknown }

export interface VideoUpload {
  status: UploadStatus
  /** Validates first: a rejected file never reaches the network. */
  start: (file: File, annotateVideo: boolean) => void
  cancel: () => void
}

interface UploadVariables {
  file: File
  annotateVideo: boolean
}

/**
 * The upload, as a normal mutation plus the byte-level progress `useMutation`
 * has no way to carry.
 *
 * Navigation is the caller's: this hook refreshes the match list and hands the
 * result on, so it stays usable from anywhere that can upload.
 */
export function useVideoUpload({
  onUploaded,
}: {
  onUploaded?: (result: UploadResult) => void
} = {}): VideoUpload {
  const queryClient = useQueryClient()

  const [rejection, setRejection] =
    useState<Extract<UploadStatus, { phase: 'rejected' }>>()
  const [progress, setProgress] = useState<{ loaded: number; total: number }>()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [cancelled, setCancelled] = useState(false)

  const controller = useRef<AbortController>(null)
  const startedAt = useRef(0)

  const mutation = useMutation({
    mutationFn: ({ file, annotateVideo }: UploadVariables) => {
      controller.current = new AbortController()
      startedAt.current = Date.now()

      return uploadVideo(file, {
        annotateVideo,
        signal: controller.current.signal,
        onProgress: ({ loaded, total }) => {
          setProgress({ loaded, total })
          setElapsedMs(Date.now() - startedAt.current)
        },
      })
    },

    // The match shows up in the list as a `processing` stub straight away, so
    // the dashboard is the progress surface from here on.
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: qk.matches() })
      onUploaded?.(result)
    },
  })

  const file = mutation.variables?.file
  const status = useMemo<UploadStatus>(() => {
    if (rejection) return rejection
    if (!file) return { phase: 'idle' }

    const total = progress?.total ?? file.size

    if (mutation.isPending) {
      const loaded = progress?.loaded ?? 0

      return loaded >= total && total > 0
        ? { phase: 'processing', fileName: file.name, total }
        : { phase: 'uploading', fileName: file.name, loaded, total, elapsedMs }
    }

    // Before the error: an abort rejects the request, and a cancelled upload is
    // not a failure the user needs to read about.
    if (cancelled) return { phase: 'cancelled', fileName: file.name }
    if (mutation.isError) {
      return { phase: 'failed', fileName: file.name, error: mutation.error }
    }

    return { phase: 'idle' }
  }, [
    rejection,
    file,
    progress,
    elapsedMs,
    cancelled,
    mutation.isPending,
    mutation.isError,
    mutation.error,
  ])

  return {
    status,

    start: (nextFile, annotateVideo) => {
      setCancelled(false)
      setProgress(undefined)
      setElapsedMs(0)
      mutation.reset()

      const reason = rejectFile(nextFile)
      if (reason) {
        setRejection({ phase: 'rejected', fileName: nextFile.name, reason })
        return
      }

      setRejection(undefined)
      mutation.mutate({ file: nextFile, annotateVideo })
    },

    cancel: () => {
      setCancelled(true)
      controller.current?.abort()
    },
  }
}
