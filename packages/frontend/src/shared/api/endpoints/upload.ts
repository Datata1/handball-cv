import { apiUrl, request } from '../client'
import { outputVideoSchema, uploadResultSchema } from '../schemas/upload'

export interface UploadOptions {
  /**
   * Renders the annotated debug video during ingestion. Off by default: the
   * per-frame drawing and H.264 encode are the most expensive part of the run.
   */
  annotateVideo?: boolean
  signal?: AbortSignal
}

/**
 * Uploads a match video and starts the pipeline. Resolves as soon as the file
 * is written — ingestion continues in a background thread, and the match
 * appears in the list as `processing`.
 *
 * `fetch` gives no upload progress, and these files are multi-gigabyte. PR 10
 * sends the same request over `XMLHttpRequest` for a real progress bar; this
 * function stays for callers that do not need one.
 */
export function uploadVideo(file: File, options: UploadOptions = {}) {
  const form = new FormData()
  form.append('file', file)
  form.append('annotate_video', String(options.annotateVideo ?? false))

  return request('/videos/upload', uploadResultSchema, {
    method: 'POST',
    signal: options.signal,
    body: form,
    // No Content-Type: the browser has to set the multipart boundary itself.
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
