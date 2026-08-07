import path from 'node:path'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Deliberately NOT an extension of vite.config.ts. That config runs
// tanstackRouter({ autoCodeSplitting: true }), which rewrites route modules
// into virtual split chunks — a transform we do not want inside the test
// runner, where a story imports a route module directly. Everything the tests
// need from the app config (the `@` alias, JSX, Tailwind) is restated here,
// and nothing else is.
const shared = {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // composeStories tests read more cleanly without an import line per file.
    globals: true,
    // Resolve the Tailwind entry rather than stubbing it: components under
    // test carry token-driven classes, and a story that imports CSS should
    // not explode.
    css: true,
  },
}

export default defineConfig({
  test: {
    projects: [
      // Hand-written assertions — behaviour, and the axe check via
      // expectNoA11yViolations. These render composed stories, never bespoke
      // fixtures, so a test and its story cannot drift.
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'unit',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
      },

      // Every story, rendered and a11y-checked, with no test file required.
      // This is the floor: a component that ships a story is covered even
      // before anyone writes an assertion about it. No setup file: since 10.3
      // addon-vitest applies .storybook/preview.ts and the addons' runtime
      // hooks itself, so `a11y.test: 'error'` over there is what makes a story
      // fail here.
      {
        ...shared,
        plugins: [...shared.plugins, storybookTest({ configDir: '.storybook' })],
        test: {
          ...shared.test,
          name: 'storybook',
          server: {
            deps: {
              // Not optional. addon-a11y only *throws* on a violation when it
              // sees import.meta.env.VITEST_STORYBOOK, which the storybookTest
              // plugin supplies via test.env. Left externalised, the addon
              // reads node's bare import.meta, the check silently degrades to
              // "report but pass", and every story is green forever.
              inline: ['@storybook/addon-a11y'],
            },
          },
        },
      },
    ],

    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.stories.tsx', 'src/routeTree.gen.ts', 'src/test/**'],
    },
  },
})
