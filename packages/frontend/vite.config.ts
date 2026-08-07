import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Must come BEFORE the react plugin: it generates src/routeTree.gen.ts
    // from the files in src/routes/ and rewrites route modules for code
    // splitting, and react() has to see the rewritten output.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // Excludes src/routes/{stories,tests}/. Matched against each path
      // segment separately, so it can name a directory but must not contain
      // a slash.
      routeFileIgnorePattern: '^(stories|tests)$',
    }),
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    port: 3000,
    strictPort: true,
  },

  preview: {
    port: 3000,
    strictPort: true,
  },
})
