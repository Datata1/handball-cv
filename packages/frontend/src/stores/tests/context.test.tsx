import { act, render, renderHook, screen } from '@testing-library/react'
import { observer } from 'mobx-react-lite'

import { createRootStore, StoreProvider, usePlayer, useStores } from '@/stores'

describe('StoreProvider', () => {
  it('hands every consumer the same store', () => {
    const store = createRootStore()

    const { result } = renderHook(() => [useStores(), usePlayer()] as const, {
      wrapper: ({ children }) => (
        <StoreProvider store={store}>{children}</StoreProvider>
      ),
    })

    expect(result.current[0]).toBe(store)
    expect(result.current[1]).toBe(store.player)
  })

  it('builds its own store when a story or the app does not supply one', () => {
    const { result } = renderHook(() => useStores(), {
      wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
    })

    expect(result.current.player.currentTime).toBe(0)
  })

  it('fails loudly outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useStores())).toThrow(/StoreProvider/)

    vi.restoreAllMocks()
  })

  // The whole reason MobX is here: the clock ticks many times a second, and
  // only the components that read it may re-render.
  it('re-renders the observer of a tick and nothing above it', () => {
    const renders = { section: 0, playhead: 0 }

    const Playhead = observer(function Playhead() {
      renders.playhead++
      return <span data-testid="playhead">{usePlayer().currentTime}</span>
    })

    function Section() {
      renders.section++
      return <Playhead />
    }

    const store = createRootStore()
    render(
      <StoreProvider store={store}>
        <Section />
      </StoreProvider>,
    )

    act(() => store.player.setTime(3))

    expect(screen.getByTestId('playhead')).toHaveTextContent('3')
    expect(renders).toEqual({ section: 1, playhead: 2 })
  })
})
