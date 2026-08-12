import { composeStories } from '@storybook/react-vite'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import { WINDOW_DEBOUNCE_MS } from '../../components/TimeWindow'
import * as stories from '../../stories/components/TimeWindow.stories'

const { Default, Windowed, WithinPhase } = composeStories(stories)

function slider(name: string): HTMLInputElement {
  return screen.getByRole('slider', { name }) as HTMLInputElement
}

function drag(input: HTMLInputElement, value: number) {
  fireChange(input, String(value))
}

/** `type="range"` takes no keystrokes in jsdom; a change event is the drag. */
function fireChange(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set

  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('TimeWindow', () => {
  it('starts on the whole match, with nothing to reset', async () => {
    render(<Default />)

    expect(await screen.findByText('00:00 bis 40:00')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ganzes Spiel' })).toBeNull()
  })

  it('restores a window from the URL', async () => {
    render(<Windowed />)

    expect(await screen.findByText('05:00 bis 15:00')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ganzes Spiel' })).toBeVisible()
  })

  // The phase is what "everything" means once one is picked.
  it('is bounded by the selected phase rather than by the match', async () => {
    render(<WithinPhase />)

    expect(await screen.findByRole('slider', { name: 'Von' })).toHaveAttribute(
      'min',
      '120',
    )
    expect(screen.getByRole('slider', { name: 'Bis' })).toHaveAttribute('max', '141')
  })

  it('writes both bounds together, once the drag has settled', async () => {
    vi.useFakeTimers()
    const onChange = fn()

    try {
      render(<Windowed onChange={onChange} />)
      await act(async () => {})

      drag(slider('Von'), 400)
      drag(slider('Von'), 500)
      drag(slider('Von'), 600)

      expect(onChange).not.toHaveBeenCalled()

      act(() => void vi.advanceTimersByTime(WINDOW_DEBOUNCE_MS))

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: 600, to: 900 })
    } finally {
      vi.useRealTimers()
    }
  })

  // Dropping half of the pair would show more of the match than the URL claims.
  it('reports the whole match as no window rather than as its bounds', async () => {
    vi.useFakeTimers()
    const onChange = fn()

    try {
      render(<Windowed onChange={onChange} />)
      await act(async () => {})

      drag(slider('Von'), 0)
      drag(slider('Bis'), 2_400)

      act(() => void vi.advanceTimersByTime(WINDOW_DEBOUNCE_MS))

      expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never lets the start pass the end', async () => {
    vi.useFakeTimers()
    const onChange = fn()

    try {
      render(<Windowed onChange={onChange} />)
      await act(async () => {})

      drag(slider('Von'), 2_000)

      act(() => void vi.advanceTimersByTime(WINDOW_DEBOUNCE_MS))

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: 900, to: 900 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets to the whole match immediately', async () => {
    const user = userEvent.setup()
    const onChange = fn()
    render(<Windowed onChange={onChange} />)

    await user.click(await screen.findByRole('button', { name: 'Ganzes Spiel' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
  })

  // Two controls for one value, so they cannot share an accessible name.
  it('offers an exact second beside each slider', async () => {
    render(<Windowed />)

    expect(
      await screen.findByRole('spinbutton', { name: 'Von, Sekunde im Spiel' }),
    ).toHaveValue(300)
    expect(
      screen.getByRole('spinbutton', { name: 'Bis, Sekunde im Spiel' }),
    ).toHaveValue(900)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Windowed />)
    await screen.findByRole('slider', { name: 'Von' })

    await expectNoA11yViolations(container)
  })
})
