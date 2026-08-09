/** A match date in the user's locale. `null` when the backend sent none. */
export function formatMatchDate(iso: string | null, locale?: string): string | null {
  if (!iso) return null

  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  return at.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
