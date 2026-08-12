import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/UploadProgress.stories'

const { Starting, Midway, Complete, Processing, SmallFile } = composeStories(stories)

const onCancel = fn()

beforeEach(() => {
  onCancel.mockClear()
})

describe('UploadProgress', () => {
  it('reports the real share of the file, not just that something is happening', () => {
    render(<Midway />)

    const bar = screen.getByRole('progressbar', { name: 'Upload-Fortschritt' })
    expect(bar).toHaveAttribute('aria-valuenow', '45')
    expect(screen.getByText('1,4 GB von 3 GB')).toBeVisible()
  })

  it('shows a rate and an ETA once there is enough signal', () => {
    render(<Midway />)

    expect(screen.getByText('30 MB/s')).toBeVisible()
    expect(screen.getByText('noch etwa 55 s')).toBeVisible()
  })

  it('shows neither before the first seconds are up', () => {
    render(<Starting />)

    expect(screen.getByText('0 B von 3 GB')).toBeVisible()
    expect(screen.queryByText(/noch etwa/)).not.toBeInTheDocument()
  })

  // A live region fed the exact percent would be read out several times a
  // second and understood as noise, so it moves in quarters.
  it('announces progress in quarters rather than per percent', () => {
    const { unmount } = render(<Midway />)
    expect(screen.getByText('Upload zu 25 % übertragen')).toBeVisible()
    unmount()

    render(<Complete />)
    expect(screen.getByText('Upload zu 100 % übertragen')).toBeVisible()
  })

  it('stops announcing progress once there is none left to make', () => {
    render(<Processing />)

    expect(screen.queryByText(/Upload zu/)).not.toBeInTheDocument()
  })

  // The state the legacy spinner never distinguished from being stuck.
  it('explains the wait after the last byte instead of parking at 100%', () => {
    render(<Processing />)

    expect(screen.getByText('Wird verarbeitet…')).toBeVisible()
    expect(screen.getByText(/liest sie einmal komplett ein/)).toBeVisible()
  })

  it('offers no cancel once the bytes are already on the server', () => {
    const { unmount } = render(<Complete onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
    unmount()

    render(<Processing onCancel={onCancel} />)
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument()
  })

  it('cancels on request', async () => {
    const user = userEvent.setup()
    render(<Midway onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('warns about the server buffering only when the file is big enough to hurt', () => {
    const { unmount } = render(<SmallFile />)
    expect(screen.queryByText(/Arbeitsspeicher/)).not.toBeInTheDocument()
    unmount()

    render(<Midway />)
    expect(screen.getByText(/Arbeitsspeicher/)).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Midway onCancel={onCancel} />)

    await expectNoA11yViolations(container)
  })
})
