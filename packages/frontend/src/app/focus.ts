/** What the skip link points at, and what a route change moves focus to. */
export const MAIN_CONTENT_ID = 'main-content'

const HEADING = 'h1, h2, h3'

/**
 * What to say about the view that was just navigated to: the heading it leads
 * with.
 *
 * Empty while the route is still loading — there is no heading yet, and
 * announcing the previous view's name would be worse than announcing nothing.
 */
export function viewName(target: HTMLElement): string {
  const heading = target.matches(HEADING) ? target : target.querySelector(HEADING)

  return heading?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}
