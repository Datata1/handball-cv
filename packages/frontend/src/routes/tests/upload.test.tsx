import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'
import { type FakeXhr, stubXhr } from '@/testing/xhr'

const RESULT = {
  match_id: 'ab12cd34',
  filename: 'ab12cd34_spiel.mp4',
  status: 'processing',
  message: 'Video uploaded successfully. Processing has started.',
}

function videoFile() {
  return new File(['x'], 'spiel.mp4', { type: 'video/mp4' })
}

function formBody(request: FakeXhr | undefined): FormData {
  if (!(request?.body instanceof FormData)) throw new Error('no multipart body sent')

  return request.body
}

function dropzone() {
  return screen.findByLabelText(/Video hierher ziehen/)
}

/** The upload flow end to end: the route, the hook and the XHR endpoint. */
describe('upload route', () => {
  let requests: FakeXhr[]

  beforeEach(() => {
    stubApi({ '/matches': [] })
    requests = stubXhr()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the picked file, with the annotate flag the checkbox is in', async () => {
    const user = userEvent.setup()
    renderApp('/upload')

    await user.click(await screen.findByRole('checkbox'))
    await user.upload(await dropzone(), videoFile())

    expect(requests).toHaveLength(1)
    const body = formBody(requests[0])
    expect((body.get('file') as File).name).toBe('spiel.mp4')
    expect(body.get('annotate_video')).toBe('true')
  })

  it('never sends a file the pipeline cannot read', async () => {
    renderApp('/upload')
    await dropzone()

    // Dropped rather than picked: the file input's `accept` already filters the
    // picker, so a drop is the path that can actually reach this check.
    fireEvent.drop(screen.getByText(/Video hierher ziehen/), {
      dataTransfer: { files: [new File(['x'], 'notizen.txt', { type: 'text/plain' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '„txt“ wird nicht unterstützt',
    )
    expect(requests).toHaveLength(0)
  })

  it('shows the bytes as they go, then the wait for the server', async () => {
    const user = userEvent.setup()
    renderApp('/upload')

    await user.upload(await dropzone(), videoFile())
    act(() => requests[0]?.progress(500_000, 1_000_000))

    expect(await screen.findByText('500 kB von 1 MB')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')

    act(() => requests[0]?.progress(1_000_000, 1_000_000))

    expect(await screen.findByText('Wird verarbeitet…')).toBeVisible()
  })

  it('cancels the transfer on request and offers the picker again', async () => {
    const user = userEvent.setup()
    renderApp('/upload')

    await user.upload(await dropzone(), videoFile())
    act(() => requests[0]?.progress(200_000, 1_000_000))
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))

    expect(requests[0]?.aborted).toBe(true)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Upload von „spiel.mp4“ abgebrochen',
    )
    expect(await dropzone()).toBeEnabled()
  })

  it('lands on the dashboard once the server has taken the file', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/upload')

    await user.upload(await dropzone(), videoFile())
    act(() => requests[0]?.respond(200, RESULT))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      vi.mocked(fetch).mock.calls.some(([input]) => String(input).endsWith('/matches')),
    ).toBe(true)
  })

  it('keeps a failed upload on the page, with a reason', async () => {
    const user = userEvent.setup()
    renderApp('/upload')

    await user.upload(await dropzone(), videoFile())
    act(() =>
      requests[0]?.respond(400, {
        detail: 'Unsupported file format: mp4. Supported: mp4, avi, mov, mkv',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Upload ist fehlgeschlagen.',
    )
  })
})
