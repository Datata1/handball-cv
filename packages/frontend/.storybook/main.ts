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

  // The builder loads the app's vite.config.ts, which includes
  // tanstackRouter({ autoCodeSplitting: true }). That plugin rewrites route
  // modules into virtual split chunks, so a story importing a route module
  // would render a different module than the app does. Same reason
  // vitest.config.ts is standalone.
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
