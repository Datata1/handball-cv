import { BACKEND_URL } from '@/lib/env'

import { getFormationScenes } from '../endpoints/formations'
import {
  deleteMatch,
  getHeatmapPoints,
  listMatches,
  matchThumbnailUrl,
  matchVideoUrl,
  patchMatch,
} from '../endpoints/matches'
import { getPlays } from '../endpoints/plays'
import { getTeamPhases } from '../endpoints/teamPhases'
import { outputVideoDownloadUrl, uploadVideo } from '../endpoints/upload'

import formationScenes from './fixtures/formation-scenes.json'
import heatmapPoints from './fixtures/heatmap-points.json'
import matches from './fixtures/matches.json'
import plays from './fixtures/plays.json'
import teamPhases from './fixtures/team-phases.json'

function mockFetch(body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The URL the last call was made to. */
function calledUrl(fetchMock: ReturnType<typeof mockFetch>) {
  return new URL(String(fetchMock.mock.calls.at(-1)?.[0]))
}

/** The init the last call was made with. */
function calledInit(fetchMock: ReturnType<typeof mockFetch>) {
  const init = fetchMock.mock.calls.at(-1)?.[1]
  if (!init) throw new Error('fetch was called without an init')

  return init
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('endpoints hit the paths the backend actually mounts', () => {
  it('lists matches', async () => {
    const fetchMock = mockFetch(matches)

    await expect(listMatches()).resolves.toHaveLength(1)
    expect(calledUrl(fetchMock).pathname).toBe('/api/v1/matches')
  })

  it('escapes a match id into the path', async () => {
    const fetchMock = mockFetch(teamPhases)

    await getTeamPhases('a/b?c')

    expect(calledUrl(fetchMock).pathname).toBe('/api/v1/matches/a%2Fb%3Fc/team-phases')
  })
})

describe('query params', () => {
  it('maps camelCase filters onto the backend snake_case names', async () => {
    const fetchMock = mockFetch(heatmapPoints)

    await getHeatmapPoints('m1', {
      phaseId: 2,
      trackIds: [4, 9],
      perspective: 'defense',
      windowStartS: 12,
      windowEndS: 30,
    })

    expect(Object.fromEntries(calledUrl(fetchMock).searchParams)).toEqual({
      phase_id: '2',
      track_ids: '4,9',
      perspective: 'defense',
      window_start_s: '12',
      window_end_s: '30',
    })
  })

  it('sends no params at all when nothing is filtered', async () => {
    const fetchMock = mockFetch(heatmapPoints)

    await getHeatmapPoints('m1')

    expect([...calledUrl(fetchMock).searchParams]).toEqual([])
  })

  it('filters formation scenes by team and label', async () => {
    const fetchMock = mockFetch(formationScenes)

    await getFormationScenes('m1', { team: 'A', formation: '6-0' })

    expect(Object.fromEntries(calledUrl(fetchMock).searchParams)).toEqual({
      team: 'A',
      formation: '6-0',
    })
  })

  it('filters plays by play type', async () => {
    const fetchMock = mockFetch(plays)

    await getPlays('m1', { playType: 'kreuzen' })

    expect(calledUrl(fetchMock).searchParams.get('play_type')).toBe('kreuzen')
  })
})

describe('mutations', () => {
  it('PATCHes JSON', async () => {
    const fetchMock = mockFetch({ ok: true })

    await patchMatch('m1', { display_name: 'Derby' })

    const init = calledInit(fetchMock)
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe('{"display_name":"Derby"}')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('DELETEs and returns the deleted id', async () => {
    mockFetch({ ok: true, deleted: 'm1' })

    await expect(deleteMatch('m1')).resolves.toEqual({ ok: true, deleted: 'm1' })
  })

  it('uploads multipart without setting Content-Type itself', async () => {
    const fetchMock = mockFetch({
      match_id: 'ab12cd34',
      filename: 'ab12cd34_spiel.mp4',
      status: 'processing',
      message: 'Video uploaded successfully. Processing has started.',
    })

    await uploadVideo(new File(['x'], 'spiel.mp4', { type: 'video/mp4' }), {
      annotateVideo: true,
    })

    const init = calledInit(fetchMock)
    const body = init.body as FormData
    // Setting it by hand would omit the multipart boundary and 422 the request.
    expect(init.headers).toBeUndefined()
    expect((body.get('file') as File).name).toBe('spiel.mp4')
    expect(body.get('annotate_video')).toBe('true')
  })
})

describe('binary endpoints are URL builders, never fetches', () => {
  it('builds an inline, range-capable video src', () => {
    expect(matchVideoUrl('m1')).toBe(`${BACKEND_URL}/api/v1/matches/m1/video`)
  })

  it('builds a thumbnail src', () => {
    expect(matchThumbnailUrl('m1')).toBe(`${BACKEND_URL}/api/v1/matches/m1/thumbnail`)
  })

  // Content-Disposition: attachment — this one downloads, it does not play.
  it('builds a download URL for the annotated video', () => {
    expect(outputVideoDownloadUrl('m1')).toBe(
      `${BACKEND_URL}/api/v1/videos/m1/output/video`,
    )
  })
})
