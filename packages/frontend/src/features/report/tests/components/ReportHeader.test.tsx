import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ReportHeader.stories'
import { rename as renameBundle } from '../../stories/report'

const { Default, Unnamed, Processing, Saving, RenameFailed } = composeStories(stories)

const bundle = renameBundle()
const rename = vi.mocked(bundle.rename)

beforeEach(() => {
  rename.mockClear()
})

describe('ReportHeader', () => {
  it('puts the match name in the page heading', async () => {
    render(<Default />)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Testspiel Nord vs Süd',
    )
  })

  it('shows the teams, the recording date and the length', async () => {
    render(<Default />)

    expect(await screen.findByText('HSG Nord')).toBeVisible()
    expect(screen.getByText('TV Süd')).toBeVisible()
    expect(screen.getByText('07.08.2026')).toBeVisible()
    expect(screen.getByText('40:00')).toBeVisible()
  })

  it('offers the file name as the placeholder for an unnamed match', async () => {
    render(<Unnamed />)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'seed01.mp4',
    )
  })

  it('saves a corrected team name against its own field', async () => {
    const user = userEvent.setup()
    render(<Default rename={bundle} />)

    await user.click(
      await screen.findByRole('button', { name: 'Mannschaft B bearbeiten' }),
    )
    const input = screen.getByRole('textbox', { name: 'Mannschaft B' })

    await user.clear(input)
    await user.type(input, 'SC Magdeburg{Enter}')

    expect(rename).toHaveBeenCalledExactlyOnceWith(
      'seed01',
      'team_b_name',
      'SC Magdeburg',
    )
  })

  // The names live in a meta file the pipeline never touches, so they stay
  // editable while the video is still being read.
  it('keeps the names editable while the match is processing', async () => {
    render(<Processing />)

    expect(
      await screen.findByRole('button', { name: 'Mannschaft A bearbeiten' }),
    ).toBeVisible()
  })

  it('marks the field being saved as busy', async () => {
    render(<Saving />)

    expect(
      await screen.findByRole('button', { name: 'Mannschaft A bearbeiten' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('shows a failed rename on the field that failed', async () => {
    render(<RenameFailed />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Name konnte nicht gespeichert werden.',
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('heading', { level: 1 })

    await expectNoA11yViolations(container)
  })
})
