import type { Preview } from '@storybook/react-vite'

import { AppProviders } from '../src/app/providers'
import '../src/styles/index.css'

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
        ],
      },
    },
  },
}

export default preview
