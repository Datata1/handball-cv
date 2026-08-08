import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach } from 'vitest'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/form/EditableField.stories'

const { Default, Unset, Pending, Failed, SaveFails, OnChrome } = composeStories(stories)

const TRIGGER = { name: 'Heimmannschaft bearbeiten' }
const FIELD = { name: 'Heimmannschaft' }

beforeEach(() => {
  Default.args.onSave?.mockClear()
})

async function startEditing() {
  const user = userEvent.setup()
  render(<Default />)

  await user.click(screen.getByRole('button', TRIGGER))

  return { user, input: screen.getByRole('textbox', FIELD) }
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByRole('textbox', FIELD)
  await user.clear(input)
  await user.type(input, text)
}

describe('EditableField', () => {
  it('names the trigger after the field, not "bearbeiten"', () => {
    render(<Default />)

    expect(screen.getByRole('button', TRIGGER)).toHaveTextContent(
      'TSV Hannover-Burgdorf',
    )
  })

  it('opens an input with the current value selected', async () => {
    const { input } = await startEditing()

    expect(input).toHaveValue('TSV Hannover-Burgdorf')
    expect(input).toHaveFocus()
  })

  it('sizes the input to the draft rather than jumping to a fixed width', async () => {
    const { user, input } = await startEditing()
    const opened = input.getAttribute('size')

    await type(user, 'Ein deutlich längerer Mannschaftsname')

    expect(Number(input.getAttribute('size'))).toBeGreaterThan(Number(opened))
  })

  it('commits on Enter', async () => {
    const { user } = await startEditing()

    await type(user, 'SC Magdeburg{Enter}')

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  it('commits from the confirm button', async () => {
    const { user } = await startEditing()

    await type(user, 'SC Magdeburg')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  it('reaches the confirm button by keyboard without losing the draft', async () => {
    const { user } = await startEditing()

    await type(user, 'SC Magdeburg')
    await user.tab()
    await user.keyboard('{Enter}')

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  it('trims what it commits', async () => {
    const { user } = await startEditing()

    await type(user, '  SC Magdeburg  {Enter}')

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  it('does not save an unchanged value', async () => {
    const { user } = await startEditing()

    await user.keyboard('{Enter}')

    expect(Default.args.onSave).not.toHaveBeenCalled()
  })

  it('reverts on Escape without saving', async () => {
    const { user } = await startEditing()

    await type(user, 'Falscheingabe{Escape}')

    expect(Default.args.onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', TRIGGER)).toHaveTextContent(
      'TSV Hannover-Burgdorf',
    )
  })

  it('discards from the cancel button', async () => {
    const { user } = await startEditing()

    await type(user, 'Falscheingabe')
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(Default.args.onSave).not.toHaveBeenCalled()
  })

  // The legacy component committed here, so clicking anywhere on the page saved
  // whatever was half-typed. Saving is deliberate now; leaving discards.
  it('discards when focus leaves the field', async () => {
    const { user } = await startEditing()

    await type(user, 'Falscheingabe')
    await user.click(document.body)

    expect(Default.args.onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', TRIGGER)).toHaveTextContent(
      'TSV Hannover-Burgdorf',
    )
  })

  it.each([
    ['Enter', '{Enter}'],
    ['Escape', '{Escape}'],
  ])('returns focus to the trigger after %s', async (_key, sequence) => {
    const { user } = await startEditing()

    await user.keyboard(sequence)

    expect(screen.getByRole('button', TRIGGER)).toHaveFocus()
  })

  it('reads as unset rather than as a value when empty', () => {
    render(<Unset />)

    expect(screen.getByRole('button', TRIGGER)).toHaveTextContent(
      'Mannschaft eintragen',
    )
  })

  it('stays focusable while a save is in flight', () => {
    render(<Pending />)

    const trigger = screen.getByRole('button', TRIGGER)
    expect(trigger).toBeEnabled()
    expect(trigger).toHaveAttribute('aria-busy', 'true')
    expect(trigger).toHaveTextContent('Wird gespeichert…')
  })

  it('surfaces a failed save as an alert', () => {
    render(<Failed />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Der Name konnte nicht gespeichert werden.',
    )
  })

  it('reopens on the text that failed, so the edit is not lost', async () => {
    const user = userEvent.setup()
    render(<SaveFails />)

    await user.click(screen.getByRole('button', TRIGGER))
    await type(user, 'SC Magdeburg{Enter}')

    expect(screen.getByRole('textbox', FIELD)).toHaveValue('SC Magdeburg')
    expect(screen.getByRole('alert')).toBeVisible()
  })

  it('lets go of the failed text once the user cancels', async () => {
    const user = userEvent.setup()
    render(<SaveFails />)

    await user.click(screen.getByRole('button', TRIGGER))
    await type(user, 'SC Magdeburg{Enter}')
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', TRIGGER)).toHaveTextContent(
      'TSV Hannover-Burgdorf',
    )
  })

  it.each([
    ['on a card', Default],
    ['on the navy chrome', OnChrome],
    ['while failed', Failed],
  ])('has no accessibility violations %s', async (_case, Story) => {
    const { container } = render(<Story />)

    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations while editing', async () => {
    const { container } = render(<Default />)
    await userEvent.setup().click(screen.getByRole('button', TRIGGER))

    await expectNoA11yViolations(container)
  })
})
