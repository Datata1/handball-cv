import { prettifyError } from 'zod'

import { apiUrl, parseErrorDetail, request } from '../client'
import { ApiError, ApiTransportError, ApiValidationError } from '../errors'
import {
  outputVideoSchema,
  type UploadResult,
  uploadResultSchema,
} from '../schemas/upload'

/** Bytes on the wire so far, reported per `progress` event. */
export interface UploadProgress {
  loaded: number
  total: number
}

export interface UploadOptions {
  /**
   * Renders the annotated debug video during ingestion. Off by default: the
   * per-frame drawing and H.264 encode are the most expensive part of the run.
   */
  annotateVideo?: boolean
  /** Called for every `progress` event whose length is computable. */
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

const UPLOAD_PATH = '/videos/upload'

/**
 * Uploads a match video and starts the pipeline. Resolves as soon as the file
 * is written — ingestion continues in a background thread, and the match
 * appears in the list as `processing`.
 *
 * The one endpoint that does not go through `request()`: `fetch` cannot report
 * how much of a request body has been sent, and a match video is gigabytes, so
 * this is `XMLHttpRequest` purely for `upload.onprogress` and `abort()`. The
 * errors it throws are the same three the fetch client throws.
 *
 * Note the response lands **later** than the last progress event: the backend
 * reads the whole upload into memory before answering (`upload.py:133`).
 */
export function uploadVideo(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const { annotateVideo = false, onProgress, signal } = options

  const form = new FormData()
  form.append('file', file)
  form.append('annotate_video', String(annotateVideo))

  return new Promise<UploadResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', apiUrl(UPLOAD_PATH))
    // No Content-Type header: the browser has to set the multipart boundary
    // itself. No timeout either — minutes of transfer is the normal case here.

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.({ loaded: event.loaded, total: event.total })
      }
    }

    xhr.onload = () => settle(xhr, resolve, reject)
    xhr.onerror = () =>
      reject(new ApiTransportError(UPLOAD_PATH, new Error('XMLHttpRequest failed')))
    xhr.onabort = () => reject(abortReason(signal))

    signal?.addEventListener('abort', () => xhr.abort(), { once: true })

    xhr.send(form)
  })
}

/** Whether the annotated video exists yet. Reads the status file, not the database. */
export function getOutputVideo(matchId: string, signal?: AbortSignal) {
  return request(`/videos/${encodeURIComponent(matchId)}/output`, outputVideoSchema, {
    signal,
  })
}

/**
 * The annotated video file.
 *
 * Sent with `Content-Disposition: attachment`, so a browser **downloads** this
 * rather than playing it. It cannot be a `<video src>`; the report player uses
 * `matchVideoUrl`, which already prefers the annotated file and serves it
 * inline. Use this for an explicit download link only.
 */
export function outputVideoDownloadUrl(matchId: string): string {
  return apiUrl(`/videos/${encodeURIComponent(matchId)}/output/video`)
}

/** The `load` half of `uploadVideo`: status, then body, then schema. */
function settle(
  xhr: XMLHttpRequest,
  resolve: (result: UploadResult) => void,
  reject: (error: unknown) => void,
): void {
  if (xhr.status < 200 || xhr.status >= 300) {
    const detail = parseErrorDetail(xhr.responseText, xhr.statusText)
    reject(new ApiError(xhr.status, detail, UPLOAD_PATH))
    return
  }

  let payload: unknown
  try {
    payload = JSON.parse(xhr.responseText)
  } catch (cause) {
    reject(new ApiTransportError(UPLOAD_PATH, cause))
    return
  }

  const result = uploadResultSchema.safeParse(payload)
  if (!result.success) {
    reject(new ApiValidationError(UPLOAD_PATH, prettifyError(result.error)))
    return
  }

  resolve(result.data)
}

// Matches fetch: an aborted request rejects with the signal's reason, so a
// caller that aborted deliberately can tell it apart from a failure.
function abortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('The upload was aborted', 'AbortError')
}
