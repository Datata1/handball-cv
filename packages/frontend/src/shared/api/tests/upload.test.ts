import { BACKEND_URL } from '@/lib/env'
import { type FakeXhr, stubXhr } from '@/testing/xhr'

import { uploadVideo } from '../endpoints/upload'
import { ApiError, ApiTransportError, ApiValidationError } from '../errors'

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

/**
 * The only endpoint on `XMLHttpRequest` rather than `fetch`, so it is also the
 * only one that has to reproduce the fetch client's error handling by hand.
 */
describe('uploadVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs multipart with the file and the annotate flag', async () => {
    const requests = stubXhr()
    const pending = uploadVideo(videoFile(), { annotateVideo: true })

    const request = requests[0]
    expect(request?.method).toBe('POST')
    expect(request?.url).toBe(`${BACKEND_URL}/api/v1/videos/upload`)

    const body = formBody(request)
    expect((body.get('file') as File).name).toBe('spiel.mp4')
    expect(body.get('annotate_video')).toBe('true')

    request?.respond(200, RESULT)
    await expect(pending).resolves.toEqual(RESULT)
  })

  it('defaults annotate_video to false', () => {
    const requests = stubXhr()
    void uploadVideo(videoFile()).catch(() => {})

    expect(formBody(requests[0]).get('annotate_video')).toBe('false')
    requests[0]?.respond(200, RESULT)
  })

  it('reports bytes on the wire as they go', async () => {
    const requests = stubXhr()
    const onProgress = vi.fn()
    const pending = uploadVideo(videoFile(), { onProgress })

    requests[0]?.progress(512, 2048)
    requests[0]?.progress(2048, 2048)

    expect(onProgress.mock.calls).toEqual([
      [{ loaded: 512, total: 2048 }],
      [{ loaded: 2048, total: 2048 }],
    ])

    requests[0]?.respond(200, RESULT)
    await pending
  })

  it('turns a 400 into an ApiError carrying the backend detail', async () => {
    const requests = stubXhr()
    const pending = uploadVideo(videoFile())

    requests[0]?.respond(400, {
      detail: 'Unsupported file format: txt. Supported: mp4, avi, mov, mkv',
    })

    await expect(pending).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      detail: 'Unsupported file format: txt. Supported: mp4, avi, mov, mkv',
    })
    await expect(pending).rejects.toBeInstanceOf(ApiError)
  })

  it('turns an unreachable server into an ApiTransportError', async () => {
    const requests = stubXhr()
    const pending = uploadVideo(videoFile())

    requests[0]?.fail()

    await expect(pending).rejects.toBeInstanceOf(ApiTransportError)
  })

  it('rejects a 200 whose body is not the documented shape', async () => {
    const requests = stubXhr()
    const pending = uploadVideo(videoFile())

    requests[0]?.respond(200, { match_id: 42 })

    await expect(pending).rejects.toBeInstanceOf(ApiValidationError)
  })

  it('aborts the request when the signal fires, and rejects with the reason', async () => {
    const requests = stubXhr()
    const controller = new AbortController()
    const pending = uploadVideo(videoFile(), { signal: controller.signal })

    controller.abort()

    expect(requests[0]?.aborted).toBe(true)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('never opens a request for a signal that is already aborted', async () => {
    const requests = stubXhr()
    const controller = new AbortController()
    controller.abort()

    await expect(
      uploadVideo(videoFile(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toHaveLength(0)
  })
})
