import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import { MIN_BAR_WIDTH_PERCENT } from '../geometry'
import * as stories from '../stories/Timeline.stories'

const { AllTracks, Empty, EmptyTracks, WithSelection, Dense, SingleTrack } =
  composeStories(stories)

/** Every accessible name a caller supplies ends in the item's time range. */
const PHASE_1 = 'Phase 1, Team A Angriff, 00:20 bis 00:38'
const PHASE_2 = 'Phase 2, Team B Angriff, 04:37 bis 05:01'
const FORMATION_1 = '6-0, Team B, 00:00 bis 13:40'
const GOAL_1 = 'Tor Team A, 1:0, 02:18'

function percent(element: HTMLElement, property: 'insetInlineStart' | 'inlineSize') {
  return Number.parseFloat(element.style[property])
}

describe('Timeline', () => {
  it('names itself and every track', () => {
    render(<AllTracks />)

    expect(screen.getByRole('group', { name: 'Zeitleiste des Spiels' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Ballbesitz' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Formationen' })).toBeVisible()
  })

  it('gives an interval a name that says what and when', () => {
    render(<AllTracks />)

    expect(screen.getByRole('button', { name: PHASE_1 })).toBeVisible()
  })

  it('names a marker by its moment, since it has no duration', () => {
    render(<AllTracks />)

    expect(screen.getByRole('button', { name: GOAL_1 })).toBeVisible()
  })

  it('places an interval at its share of the match', () => {
    render(<AllTracks />)
    const bar = screen.getByRole('button', { name: FORMATION_1 })

    expect(percent(bar, 'insetInlineStart')).toBeCloseTo(0, 5)
    expect(percent(bar, 'inlineSize')).toBeCloseTo((820 / 3_600) * 100, 5)
  })

  it('places a marker at its moment', () => {
    render(<AllTracks />)
    const tick = screen.getByRole('button', { name: GOAL_1 })

    expect(percent(tick, 'insetInlineStart')).toBeCloseTo((138 / 3_600) * 100, 5)
  })

  it('keeps a two-second play visible among three hundred others', () => {
    render(<Dense />)

    const widths = screen
      .getAllByRole('button')
      .map((bar) => percent(bar, 'inlineSize'))
      .filter((width) => !Number.isNaN(width))

    expect(widths).toHaveLength(320)
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(MIN_BAR_WIDTH_PERCENT)
  })

  it('marks the selected item pressed and announces it', () => {
    render(<WithSelection />)

    expect(screen.getByRole('button', { name: /^Phase 4/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ausgewählt: Phase 4, Team B Angriff',
    )
  })

  it('hands a click back with the item and the track it came from', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AllTracks onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: PHASE_1 }))

    expect(onSelect).toHaveBeenCalledWith({
      track: expect.objectContaining({ id: 'phases' }),
      item: expect.objectContaining({ id: 'phase-1' }),
    })
  })

  // There is no background click target: an unnamed full-width surface would be
  // unreachable for everyone not using a mouse.
  it('clears the selection when the selected item is clicked again', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<WithSelection onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /^Phase 4/ }))

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('clears the selection on Escape', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<WithSelection onSelect={onSelect} />)

    await user.tab()
    await user.keyboard('{Escape}')

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('seeks the player to the item it selected', async () => {
    const user = userEvent.setup()
    render(<AllTracks />)

    await user.click(screen.getByRole('button', { name: PHASE_2 }))

    // The playhead reads the store, so this is the seek arriving.
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '04:37')
  })

  it('makes exactly one item tabbable, wherever the cursor sits', async () => {
    const user = userEvent.setup()
    render(<AllTracks />)

    await user.tab()

    expect(screen.getByRole('button', { name: GOAL_1 })).toHaveFocus()
  })

  it('walks a track with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<SingleTrack />)

    await user.tab()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('button', { name: PHASE_2 })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')

    expect(screen.getByRole('button', { name: PHASE_1 })).toHaveFocus()
  })

  it('crosses to the nearest item in the track below', async () => {
    const user = userEvent.setup()
    render(<AllTracks />)

    await user.tab()
    await user.keyboard('{ArrowDown}')

    // The first goal is at 02:18; of the phases, the one starting at 00:20 is
    // closer to it than the next one at 04:37.
    expect(screen.getByRole('button', { name: PHASE_1 })).toHaveFocus()
  })

  it('jumps to the ends of a track', async () => {
    const user = userEvent.setup()
    render(<SingleTrack />)

    await user.tab()
    await user.keyboard('{End}')

    expect(screen.getByRole('button', { name: /^Phase 14/ })).toHaveFocus()

    await user.keyboard('{Home}')

    expect(screen.getByRole('button', { name: PHASE_1 })).toHaveFocus()
  })

  it('selects the focused item with the keyboard', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SingleTrack onSelect={onSelect} />)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: 'phase-1' }) }),
    )
  })

  it('says so when a match has no events at all', () => {
    render(<Empty />)

    expect(
      screen.getByText('Für dieses Spiel sind noch keine Ereignisse erkannt.'),
    ).toBeVisible()
  })

  it('keeps the lanes when the tracks are known but empty', () => {
    render(<EmptyTracks />)

    expect(screen.getByRole('group', { name: 'Spielzüge' })).toBeVisible()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it.each([
    ['with every track', <AllTracks key="all" />],
    ['with a selection', <WithSelection key="selected" />],
    ['with nothing to show', <Empty key="empty" />],
  ])('has no accessibility violations %s', async (_name, ui) => {
    const { container } = render(ui)

    await expectNoA11yViolations(container)
  })
})
