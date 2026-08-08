import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach } from 'vitest'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/form/EditableField.stories'

const { Default, Unset, Pending, Failed, OnChrome } = composeStories(stories)

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

  it('commits on Enter', async () => {
    const { user, input } = await startEditing()

    await user.clear(input)
    await user.type(input, 'SC Magdeburg{Enter}')

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  it('trims what it commits', async () => {
    const { user, input } = await startEditing()

    await user.clear(input)
    await user.type(input, '  SC Magdeburg  {Enter}')

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  it('reverts on Escape without saving', async () => {
    const { user, input } = await startEditing()

    await user.clear(input)
    await user.type(input, 'Falscheingabe{Escape}')

    expect(Default.args.onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', TRIGGER)).toHaveTextContent(
      'TSV Hannover-Burgdorf',
    )
  })

  it('commits on blur', async () => {
    const { user, input } = await startEditing()

    await user.clear(input)
    await user.type(input, 'SC Magdeburg')
    await user.tab()

    expect(Default.args.onSave).toHaveBeenCalledExactlyOnceWith('SC Magdeburg')
  })

  // The trap the legacy component's cancelledRef existed to avoid: the cancel
  // button's mousedown fires before the input's blur, so an unguarded blur
  // handler saves the very edit the user just abandoned.
  it('does not save when the blur came from pressing cancel', async () => {
    const { user, input } = await startEditing()

    await user.clear(input)
    await user.type(input, 'Falscheingabe')
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(Default.args.onSave).not.toHaveBeenCalled()
  })

  it('does not save an unchanged value', async () => {
    const { user } = await startEditing()

    await user.keyboard('{Enter}')

    expect(Default.args.onSave).not.toHaveBeenCalled()
  })

  it('returns focus to the trigger after a keyboard commit', async () => {
    const { user, input } = await startEditing()

    await user.clear(input)
    await user.type(input, 'SC Magdeburg{Enter}')

    expect(screen.getByRole('button', TRIGGER)).toHaveFocus()
  })

  it('returns focus to the trigger after Escape', async () => {
    const { user } = await startEditing()

    await user.keyboard('{Escape}')

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
