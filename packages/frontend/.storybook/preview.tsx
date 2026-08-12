import type { Preview } from '@storybook/react-vite'

import { AppProviders } from '../src/app/providers'
import '../src/styles/index.css'

// jsdom has no layout and so no scrollTo, which the router calls on mount and
// on every navigation — unstubbed it prints a "Not implemented" notice per
// story and drowns the run. Here rather than in `src/testing/setup.ts` because
// both vitest projects reach this file and only one reads that one.
if (import.meta.env.MODE === 'test') {
  window.scrollTo = () => {}

  // Same for the canvas: jsdom has no rasteriser, and the density map already
  // bails when it cannot get a context. Stubbed rather than left to print,
  // because the notice arrives once per story that draws one.
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext
}

const preview: Preview = {
  // Stories mount the app's providers, so they render real German copy rather
  // than raw keys — and a missing key is visible in the workshop.
  decorators: [
    (Story) => (
      <AppProviders>
        <Story />
      </AppProviders>
    ),
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Also gates the `storybook` vitest project — addon-vitest applies these
      // annotations there.
      test: 'error',
      config: {
        rules: [
          {
            id: 'color-contrast',
            // jsdom cannot compute rendered colour. Panel only.
            enabled: import.meta.env.MODE !== 'test',
          },
          {
            id: 'video-caption',
            // A match recording has no speech to caption; WCAG 1.2.2 is about
            // audio. Revisit if commentary is ever ingested with the video.
            enabled: false,
          },
        ],
      },
    },
  },
}

export default preview
