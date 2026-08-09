import axe, { type ImpactValue, type Result } from 'axe-core'

const OPTIONS: axe.RunOptions = {
  rules: {
    // Components render outside any landmark in tests, so this only ever
    // fires on the harness.
    region: { enabled: false },

    // jsdom cannot compute rendered colour; contrast is checked in
    // Storybook's a11y panel instead.
    'color-contrast': { enabled: false },

    // A match recording has no speech, and WCAG 1.2.2 is about captioning
    // audio. Revisit if commentary is ever ingested alongside the video.
    'video-caption': { enabled: false },
  },
}

const IMPACT_ORDER: ImpactValue[] = ['critical', 'serious', 'moderate', 'minor']

function bySeverity(a: Result, b: Result): number {
  const rank = (r: Result) =>
    r.impact ? IMPACT_ORDER.indexOf(r.impact) : IMPACT_ORDER.length
  return rank(a) - rank(b)
}

function formatViolations(violations: Result[]): string {
  const count = violations.length
  const header = `${count} accessibility violation${count === 1 ? '' : 's'}:`

  const blocks = [...violations].sort(bySeverity).map((violation, index) => {
    const nodes = violation.nodes
      .map((node) => {
        const target = node.target.join(' ')
        const summary = node.failureSummary?.trim().replace(/\n/g, '\n      ')
        return [
          `    at ${target}`,
          `      ${node.html}`,
          summary ? `      ${summary}` : undefined,
        ]
          .filter(Boolean)
          .join('\n')
      })
      .join('\n\n')

    return [
      `  ${index + 1}. [${violation.impact ?? 'unknown'}] ${violation.id} — ${violation.help}`,
      nodes,
      `    ${violation.helpUrl}`,
    ].join('\n')
  })

  return [header, ...blocks].join('\n\n')
}

/** Throws a readable report if `container` has any axe violation. */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, OPTIONS)

  if (results.violations.length > 0) {
    throw new Error(formatViolations(results.violations))
  }
}
