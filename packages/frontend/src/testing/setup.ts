import '@testing-library/jest-dom/vitest'
import '@/styles/index.css'

import { setProjectAnnotations } from '@storybook/react-vite'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import preview from '../../.storybook/preview'

// Gives composeStories() the preview's decorators — without it a composed story
// renders outside the app's providers and shows raw i18n keys. The `storybook`
// vitest project gets this from addon-vitest instead.
setProjectAnnotations(preview)

// Without this, axe walks leftover DOM from earlier tests.
afterEach(() => {
  cleanup()
})
