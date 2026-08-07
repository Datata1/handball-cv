import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  core: {
    disableTelemetry: true,
  },

  // The builder loads vite.config.ts. Drop the router plugin from it, or a
  // story of a route component renders the code-split rewrite instead.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: (viteConfig.plugins ?? []).filter(
      (plugin) =>
        !(
          plugin &&
          'name' in plugin &&
          typeof plugin.name === 'string' &&
          plugin.name.startsWith('tanstack')
        ),
    ),
  }),
}

export default config
