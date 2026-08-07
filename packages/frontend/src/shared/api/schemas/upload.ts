import { z } from 'zod'

/**
 * The upload response. `match_id` is generated server-side, so this is the only
 * way to learn it — PR 10 navigates to it once the POST resolves.
 *
 * `message` is English backend prose. Do not render it; the upload feature has
 * its own copy in the `upload` namespace.
 */
export const uploadResultSchema = z.object({
  match_id: z.string(),
  /** Stored name: `<match_id>_<original>`, not the name the user picked. */
  filename: z.string(),
  status: z.string(),
  message: z.string(),
})
export type UploadResult = z.infer<typeof uploadResultSchema>

/**
 * `'ready'` means the annotated file exists on disk. The other four are the
 * pipeline status passed through — so `'done'` with `video_path: null` is the
 * normal result when ingestion ran without `annotate_video`.
 */
export const outputVideoStatusSchema = z.enum([
  'ready',
  'processing',
  'done',
  'failed',
  'unknown',
])
export type OutputVideoStatus = z.infer<typeof outputVideoStatusSchema>

export const outputVideoSchema = z.object({
  match_id: z.string(),
  /** A server-side absolute path — useless to the browser. Stream the URL instead. */
  video_path: z.string().nullable(),
  status: outputVideoStatusSchema,
})
export type OutputVideo = z.infer<typeof outputVideoSchema>
