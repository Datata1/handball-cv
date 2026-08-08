import { composeStories } from '@storybook/react-vite'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/UploadDropzone.stories'

const { Default, Dragging } = composeStories(stories)

const onSelect = fn()

function videoFile() {
  return new File(['x'], 'spiel.mp4', { type: 'video/mp4' })
}

beforeEach(() => {
  onSelect.mockClear()
})

describe('UploadDropzone', () => {
  it('exposes a real file input, so the keyboard reaches it', async () => {
    const user = userEvent.setup()
    render(<Default onSelect={onSelect} />)

    await user.tab()

    const input = screen.getByLabelText(/Video hierher ziehen/)
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('type', 'file')
    // Enter and Space open the picker natively — jsdom has no picker to open,
    // so the guarantee under test is that focus lands on the control itself.
  })

  it('accepts only the extensions the pipeline can read', () => {
    render(<Default onSelect={onSelect} />)

    expect(screen.getByLabelText(/Video hierher ziehen/)).toHaveAttribute(
      'accept',
      '.mp4,.avi,.mov,.mkv',
    )
  })

  it('hands the picked file up', async () => {
    const user = userEvent.setup()
    render(<Default onSelect={onSelect} />)

    await user.upload(screen.getByLabelText(/Video hierher ziehen/), videoFile())

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ name: 'spiel.mp4' })
  })

  it('clears the input, so the same file can be picked again after a rejection', async () => {
    const user = userEvent.setup()
    render(<Default onSelect={onSelect} />)

    const input = screen.getByLabelText(/Video hierher ziehen/) as HTMLInputElement
    await user.upload(input, videoFile())
    await user.upload(input, videoFile())

    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('takes a dropped file regardless of the MIME type the browser guessed', () => {
    render(<Default onSelect={onSelect} />)

    const dropped = new File(['x'], 'spiel.mkv', { type: '' })
    fireEvent.drop(screen.getByText(/Video hierher ziehen/), {
      dataTransfer: { files: [dropped] },
    })

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('says what to do while a file hovers over it', () => {
    render(<Dragging />)

    expect(screen.getByText('Datei hier loslassen')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default onSelect={onSelect} />)

    await expectNoA11yViolations(container)
  })
})
