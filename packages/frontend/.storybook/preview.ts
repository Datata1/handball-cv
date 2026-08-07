import type { Preview } from '@storybook/react-vite'

// Same entry main.tsx uses, so a story sees the real token layer and
// `bg-primary` is WELS blue in the canvas exactly as it is in the app.
import '../src/styles/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Surfaces violations in the a11y panel, and — because addon-vitest
    // applies these annotations to the `storybook` vitest project — fails the
    // test run on any story that regresses.
    a11y: {
      test: 'error',
      config: {
        rules: [
          {
            id: 'color-contrast',
            // jsdom has no layout engine and no canvas, so axe cannot sample
            // rendered pixels there: under vitest the rule can only return
            // "incomplete", while logging a getContext() warning per story.
            // In the browser-rendered panel it is worth having.
            enabled: import.meta.env.MODE !== 'test',
          },
        ],
      },
    },
  },
}

export default preview
