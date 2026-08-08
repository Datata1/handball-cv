import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/UploadPanel.stories'

const {
  Idle,
  Uploading,
  Processing,
  UnsupportedFormat,
  MissingExtension,
  NetworkError,
  Cancelled,
} = composeStories(stories)

const onAnnotateChange = fn()

beforeEach(() => {
  onAnnotateChange.mockClear()
})

describe('UploadPanel', () => {
  it('says what the annotate flag costs and what it buys', () => {
    render(<Idle />)

    const checkbox = screen.getByRole('checkbox', {
      name: /Annotiertes Debug-Video erzeugen/,
    })

    expect(checkbox).toHaveAccessibleDescription(/zwischen Original und annotiert/)
  })

  it('reports the flag being toggled', async () => {
    const user = userEvent.setup()
    render(<Idle onAnnotateChange={onAnnotateChange} />)

    await user.click(screen.getByRole('checkbox'))

    expect(onAnnotateChange).toHaveBeenCalledWith(true)
  })

  it('replaces the picker with progress while a file is on the wire', () => {
    render(<Uploading />)

    expect(screen.getByRole('progressbar')).toBeVisible()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('names the offending extension rather than the whole file', () => {
    render(<UnsupportedFormat />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '„txt“ wird nicht unterstützt. Erlaubt sind MP4, AVI, MOV und MKV.',
    )
  })

  it('has its own sentence for a name with no extension', () => {
    render(<MissingExtension />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '„spielaufzeichnung“ hat keine Dateiendung.',
    )
  })

  it('translates the transport failure instead of showing the English detail', () => {
    render(<NetworkError />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Der Upload ist fehlgeschlagen. Der Server ist nicht erreichbar.',
    )
  })

  it('treats a cancellation as a note, not as an error', () => {
    render(<Cancelled />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('abgebrochen')
  })

  it('leaves the picker available after a failure', () => {
    render(<NetworkError />)

    expect(screen.getByLabelText(/Video hierher ziehen/)).toBeEnabled()
  })

  it.each([
    ['idle', <Idle key="idle" />],
    ['processing', <Processing key="processing" />],
    ['rejected', <UnsupportedFormat key="rejected" />],
  ])('has no accessibility violations while %s', async (_name, ui) => {
    const { container } = render(ui)

    await expectNoA11yViolations(container)
  })
})
