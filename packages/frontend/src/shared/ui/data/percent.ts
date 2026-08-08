/** A share of `max`, clamped to 0–100 and safe for a zero or missing total. */
export function toPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0

  return Math.min(100, Math.max(0, (value / max) * 100))
}
