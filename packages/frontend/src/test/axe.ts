import axe, { type ImpactValue, type Result } from 'axe-core'

// axe-core directly, not the `vitest-axe` wrapper: that package is at 0.1.0,
// unmaintained, and adds nothing but a matcher.
const OPTIONS: axe.RunOptions = {
  rules: {
    // Components are rendered bare in tests, outside any <main>/<nav>, so
    // "all content must live in a landmark" only ever fires on the harness.
    // The full-page version of this check belongs in the a11y sweep (PR 20).
    region: { enabled: false },

    // jsdom has no layout engine and no canvas, so axe cannot sample rendered
    // pixels: this rule can only ever return "incomplete" here, while logging
    // a getContext() warning per run. Contrast is checked where it is
    // meaningful — Storybook's a11y panel, in a real browser.
    'color-contrast': { enabled: false },
  },
}

const IMPACT_ORDER: ImpactValue[] = ['critical', 'serious', 'moderate', 'minor']

function bySeverity(a: Result, b: Result): number {
  const rank = (r: Result) =>
    r.impact ? IMPACT_ORDER.indexOf(r.impact) : IMPACT_ORDER.length
  return rank(a) - rank(b)
}

/**
 * Format violations the way you will actually want to read them at 5pm: rule,
 * impact, what to fix, the offending markup, and a link.
 */
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

/**
 * Throws with a readable report if `container` has any axe violation.
 * Every component test ends with this call.
 */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, OPTIONS)

  if (results.violations.length > 0) {
    throw new Error(formatViolations(results.violations))
  }
}
