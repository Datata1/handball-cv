import { composeStories } from '@storybook/react-vite'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MatchCard.stories'
import { mutations } from '../../stories/mutations'

const {
  Default,
  WithoutScore,
  Unnamed,
  Processing,
  Failed,
  MissingThumbnail,
  Renaming,
  RenameFailed,
  DeleteFailed,
  DeleteBlocked,
} = composeStories(stories)

const OPEN_LINK = { name: 'Analyse öffnen: Testspiel Nord vs Süd' }

// The bundle the dashboard threads down, with this test holding the two ends.
const bundle = mutations()
const rename = vi.mocked(bundle.rename)
const remove = vi.mocked(bundle.remove)

beforeEach(() => {
  rename.mockClear()
  remove.mockClear()
})

async function editTeamA() {
  const user = userEvent.setup()
  render(<Default mutations={bundle} />)

  await user.click(
    await screen.findByRole('button', { name: 'Heimmannschaft bearbeiten' }),
  )

  return { user, input: screen.getByRole('textbox', { name: 'Heimmannschaft' }) }
}

describe('MatchCard', () => {
  it('links a finished match to its report', async () => {
    render(<Default />)

    expect(await screen.findByRole('link', OPEN_LINK)).toHaveAttribute(
      'href',
      '/matches/seed01',
    )
  })

  it('shows the score and the duration it measured', async () => {
    render(<Default />)

    expect(await screen.findByText('24')).toBeVisible()
    expect(screen.getByText('22')).toBeVisible()
    expect(screen.getByText('01:00')).toBeVisible()
  })

  it('shows no score for a match without scoreboard readings', async () => {
    render(<WithoutScore />)

    await screen.findByRole('link')
    expect(screen.queryByText('Spielstand')).not.toBeInTheDocument()
  })

  it('names an unnamed match after its file', async () => {
    render(<Unnamed />)

    expect(await screen.findByRole('heading', { level: 3 })).toHaveTextContent(
      'aufzeichnung-2026-05-02.mp4',
    )
  })

  it.each([
    ['processing', Processing, 'Wird verarbeitet'],
    ['failed', Failed, 'Fehlgeschlagen'],
  ])('renders a %s stub row without a link', async (_status, Story, label) => {
    render(<Story />)

    expect(await screen.findByText(label)).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('names a stub row after its id, since it has no file name yet', async () => {
    render(<Processing />)

    expect(await screen.findByRole('heading', { level: 3 })).toHaveTextContent(
      'pending9',
    )
  })

  it('falls back to a placeholder when the thumbnail cannot be decoded', async () => {
    const { container } = render(<MissingThumbnail />)
    await screen.findByRole('link')

    // Decorative, so it has no role to query by — the open link names the card.
    const image = container.querySelector('img')
    if (!image) throw new Error('the story renders a thumbnail')
    fireEvent.error(image)

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('saves a renamed team against the field it belongs to', async () => {
    const { user, input } = await editTeamA()

    await user.clear(input)
    await user.type(input, 'SC Magdeburg{Enter}')

    expect(rename).toHaveBeenCalledExactlyOnceWith(
      'seed01',
      'team_a_name',
      'SC Magdeburg',
    )
  })

  // An empty patch is a 400, so a save that changes nothing must not be sent.
  it('sends nothing when the value did not change', async () => {
    const { user } = await editTeamA()

    await user.keyboard('{Enter}')

    expect(rename).not.toHaveBeenCalled()
  })

  it('discards the edit on Escape', async () => {
    const { user, input } = await editTeamA()

    await user.clear(input)
    await user.type(input, 'SC Magdeburg{Escape}')

    expect(rename).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Heimmannschaft bearbeiten' }),
    ).toHaveTextContent('HSG Nord')
  })

  it('discards the edit when cancel is pressed', async () => {
    const { user, input } = await editTeamA()

    await user.clear(input)
    await user.type(input, 'SC Magdeburg')
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(rename).not.toHaveBeenCalled()
  })

  it('marks the field being saved as busy', async () => {
    render(<Renaming />)

    expect(
      await screen.findByRole('button', { name: 'Heimmannschaft bearbeiten' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('shows a failed rename on the field that failed', async () => {
    render(<RenameFailed />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Name konnte nicht gespeichert werden.',
    )
  })

  it('deletes only after the dialog is confirmed', async () => {
    const user = userEvent.setup()
    render(<Default mutations={bundle} />)

    await user.click(
      await screen.findByRole('button', {
        name: 'Spiel löschen: Testspiel Nord vs Süd',
      }),
    )
    expect(remove).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(remove).toHaveBeenCalledExactlyOnceWith('seed01')
  })

  it('surfaces a failed delete on the card that survived it', async () => {
    render(<DeleteFailed />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das Spiel konnte nicht gelöscht werden.',
    )
  })

  // The 404 the freeze produces says nothing about whether the match exists.
  it('says a delete during ingestion is not possible rather than failed', async () => {
    render(<DeleteBlocked />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Löschen ist gerade nicht möglich',
    )
  })

  it.each([
    ['at rest', Default],
    ['with a failed delete', DeleteBlocked],
  ])('has no accessibility violations %s', async (_case, Story) => {
    const { container } = render(<Story />)
    await screen.findByRole('link')

    await expectNoA11yViolations(container)
  })
})
