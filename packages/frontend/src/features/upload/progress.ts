/** Turning `loaded / total / elapsed` into the three numbers the UI shows. */

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB'] as const

/**
 * A rate computed over the first fraction of a second is nonsense — the socket
 * buffer swallows the first chunk whole and the reading swings by an order of
 * magnitude. Below this, the UI shows percent and bytes but no rate or ETA.
 */
const MIN_SAMPLE_MS = 1500

export interface TransferStats {
  /** 0–100, clamped: a `loaded` past `total` is possible with chunked encodings. */
  percent: number
  /** `null` until there is enough signal to mean anything. */
  bytesPerSecond: number | null
  /** `null` while the rate is, and once the transfer is complete. */
  secondsRemaining: number | null
}

export function transferStats(
  loaded: number,
  total: number,
  elapsedMs: number,
): TransferStats {
  const percent = total > 0 ? Math.min(100, (loaded / total) * 100) : 0

  const bytesPerSecond =
    elapsedMs >= MIN_SAMPLE_MS && loaded > 0 ? loaded / (elapsedMs / 1000) : null

  const remaining = Math.max(0, total - loaded)

  return {
    percent,
    bytesPerSecond,
    secondsRemaining:
      bytesPerSecond === null || remaining === 0 ? null : remaining / bytesPerSecond,
  }
}

/**
 * Decimal units, the ones a file manager and a network panel both show, so the
 * numbers here match what the user can check elsewhere.
 *
 * The unit symbols are not translated: they are the same in German, and a
 * locale only decides the decimal separator.
 */
export function formatBytes(bytes: number, locale: string): string {
  const magnitude = bytes > 0 ? Math.floor(Math.log10(bytes) / 3) : 0
  const index = Math.min(magnitude, UNITS.length - 1)
  const value = bytes / 1000 ** index

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(value)

  return `${formatted} ${UNITS[index]}`
}
