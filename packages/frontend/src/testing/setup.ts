import '@testing-library/jest-dom/vitest'
import '@/styles/index.css'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without this, axe walks leftover DOM from earlier tests.
afterEach(() => {
  cleanup()
})
