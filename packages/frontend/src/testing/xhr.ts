import { vi } from 'vitest'

/**
 * A scriptable `XMLHttpRequest`, for the one endpoint that uses it.
 *
 * jsdom's own implementation would need a real server to talk to, and the whole
 * point of the upload endpoint is the events around the transfer — so tests
 * drive those directly: `progress()` for bytes on the wire, `respond()` for the
 * reply that arrives afterwards.
 */
export class FakeXhr {
  method = ''
  url = ''
  body: FormData | null = null
  aborted = false
  status = 0
  statusText = ''
  responseText = ''

  readonly upload = { onprogress: null as ((event: ProgressEvent) => void) | null }

  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  send(body: FormData | null) {
    this.body = body
  }

  abort() {
    this.aborted = true
    this.onabort?.()
  }

  /** One `progress` event on the upload, as a browser would emit it. */
  progress(loaded: number, total: number) {
    this.upload.onprogress?.(
      new ProgressEvent('progress', { lengthComputable: true, loaded, total }),
    )
  }

  respond(status: number, body: unknown) {
    this.status = status
    this.statusText = status === 200 ? 'OK' : 'Error'
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body)
    this.onload?.()
  }

  /** A request that never produced a response: offline, DNS, CORS. */
  fail() {
    this.onerror?.()
  }
}

/**
 * Replaces `XMLHttpRequest` for the current test. Returns the list the fake
 * pushes each instance onto, so a test can reach the request it just triggered.
 */
export function stubXhr(): FakeXhr[] {
  const instances: FakeXhr[] = []

  vi.stubGlobal(
    'XMLHttpRequest',
    class extends FakeXhr {
      constructor() {
        super()
        instances.push(this)
      }
    },
  )

  return instances
}
