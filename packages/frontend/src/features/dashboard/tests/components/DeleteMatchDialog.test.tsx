import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/DeleteMatchDialog.stories'

const { Default, Open } = composeStories(stories)

const TRIGGER = { name: 'Spiel löschen: Testspiel Nord vs Süd' }

const onConfirm = fn()

beforeEach(() => {
  onConfirm.mockClear()
})

describe('DeleteMatchDialog', () => {
  it('names the match in the trigger, so a grid of them stays distinguishable', async () => {
    render(<Default onConfirm={onConfirm} />)

    expect(await screen.findByRole('button', TRIGGER)).toBeVisible()
  })

  it('says what is deleted and what survives it', async () => {
    render(<Open />)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Testspiel Nord vs Süd')
    expect(dialog).toHaveTextContent('Die Tracking-Daten in der Datenbank')
  })

  it('traps focus inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Default onConfirm={onConfirm} />)

    await user.click(await screen.findByRole('button', TRIGGER))
    const dialog = screen.getByRole('alertdialog')

    for (const _step of [1, 2, 3, 4]) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('closes on Escape without deleting', async () => {
    const user = userEvent.setup()
    render(<Default onConfirm={onConfirm} />)

    await user.click(await screen.findByRole('button', TRIGGER))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes on cancel without deleting', async () => {
    const user = userEvent.setup()
    render(<Default onConfirm={onConfirm} />)

    await user.click(await screen.findByRole('button', TRIGGER))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('deletes on confirm', async () => {
    const user = userEvent.setup()
    render(<Default onConfirm={onConfirm} />)

    await user.click(await screen.findByRole('button', TRIGGER))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('has no accessibility violations while open', async () => {
    render(<Open />)
    await screen.findByRole('alertdialog')

    // The dialog is portalled, so the render container holds only the trigger.
    await expectNoA11yViolations(document.body)
  })
})
