import path from 'node:path'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Standalone, not derived from vite.config.ts: the router plugin there
// rewrites route modules, so tests would run a different module than they
// import.
const shared = {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
  },
}

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'unit',
          setupFiles: ['./src/testing/setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
      },

      // Runs every story. No setup file: addon-vitest applies
      // .storybook/preview.ts itself.
      {
        ...shared,
        plugins: [...shared.plugins, storybookTest({ configDir: '.storybook' })],
        test: {
          ...shared.test,
          name: 'storybook',
          // Every story is also an axe run, and axe walks each focusable node:
          // the timeline's Dense story alone renders 320 bars, which takes a
          // few seconds on a loaded runner. The default 5s trips on that.
          testTimeout: 20_000,
          server: {
            deps: {
              // Required for a11y violations to fail the run: addon-a11y gates
              // that on import.meta.env.VITEST_STORYBOOK, which vitest injects
              // only into inlined modules.
              inline: ['@storybook/addon-a11y'],
            },
          },
        },
      },
    ],

    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/stories/**',
        'src/**/tests/**',
        'src/testing/**',
        'src/routeTree.gen.ts',
      ],
    },
  },
})
