/** What the client checks before spending minutes transferring a file. */

export const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv'] as const

/** For the `accept` attribute — extensions, not MIME types (see `extensionOf`). */
export const ACCEPTED_FILE_TYPES = VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(',')

/**
 * Above this the UI warns, and only warns: the backend has no size limit but
 * does `content = await file.read()`, so the whole video sits in the server's
 * memory before a byte of it is processed.
 */
export const LARGE_FILE_BYTES = 2 * 1000 ** 3

export type UploadRejection = 'unsupportedFormat' | 'missingExtension'

/**
 * The backend's own rule, byte for byte: `filename.split(".")[-1].lower()`
 * against a four-entry list (`upload.py:121`). A name with no dot therefore
 * yields the whole name and fails — which is why "missing extension" is a
 * separate message rather than a confusing "`spiel` is not supported".
 */
export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

/**
 * `null` when the file is worth sending.
 *
 * Extension only, never `file.type`: browsers report `.mkv` as an empty type on
 * most platforms, and the legacy drop handler filtered on `video/` — so
 * dropping a Matroska file silently did nothing at all.
 */
export function rejectFile(file: File): UploadRejection | null {
  if (!file.name.includes('.')) return 'missingExtension'

  return VIDEO_EXTENSIONS.some((ext) => ext === extensionOf(file.name))
    ? null
    : 'unsupportedFormat'
}

/** Whether a transfer of this size is worth warning about. */
export function isLargeFile(bytes: number): boolean {
  return bytes > LARGE_FILE_BYTES
}
