import { renderHook } from '@testing-library/react'

import { ProviderWrapper } from '@/testing/render'

import { useBackendLabel } from '../backend-label'

function labelFor() {
  const { result } = renderHook(() => useBackendLabel(), { wrapper: ProviderWrapper })
  return result.current
}

describe('useBackendLabel', () => {
  it('translates a value the catalogue knows', () => {
    expect(labelFor()('playType', 'tempogegenstoss')).toBe('Tempogegenstoß')
  })

  // The detector's label set changes with the GCN + LSTM work; an unknown value
  // must render itself rather than nothing.
  it('falls back to the raw value for an unknown one', () => {
    expect(labelFor()('playType', 'sperre_stossen')).toBe('sperre_stossen')
    expect(labelFor()('formation', '3-2-1')).toBe('3-2-1')
  })
})
