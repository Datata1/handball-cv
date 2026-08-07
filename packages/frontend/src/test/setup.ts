import '@testing-library/jest-dom/vitest'
import '@/styles/index.css'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL does not auto-clean when `globals` is on but the framework hooks are not
// registered by the library itself, so unmount between tests explicitly —
// otherwise axe walks the leftovers of every previous test.
afterEach(() => {
  cleanup()
})
