import type { OutputVideo } from '@/shared/api'

import { match, processingMatch } from '../stories/report'
import { annotatedState, matchDurationSeconds, videoSrc } from '../video'

function output(status: OutputVideo['status']): OutputVideo {
  return { match_id: 'seed01', video_path: null, status }
}

describe('annotatedState', () => {
  it('offers the toggle only once the file exists', () => {
    expect(annotatedState(output('ready'))).toBe('ready')
  })

  it('waits while the render is being made', () => {
    expect(annotatedState(output('processing'))).toBe('processing')
  })

  // `done` is reachable without a render: the upload asked for no annotation.
  it('treats a finished match with no render as having none', () => {
    expect(annotatedState(output('done'))).toBe('absent')
    expect(annotatedState(output('failed'))).toBe('absent')
    expect(annotatedState(undefined)).toBe('absent')
  })
})

describe('videoSrc', () => {
  // Both sources are named outright rather than left to the endpoint's `auto`,
  // which prefers the render — that is the whole difference between a toggle
  // and a suggestion.
  it('asks for each file by name', () => {
    expect(videoSrc('seed01', 'original')).toContain('source=original')
    expect(videoSrc('seed01', 'annotated')).toContain('source=annotated')
  })

  it('carries the playhead across a source swap as a media fragment', () => {
    expect(videoSrc('seed01', 'annotated', 754.23)).toMatch(/#t=754\.2$/)
  })

  it('adds nothing at the start of the match', () => {
    expect(videoSrc('seed01', 'original', 0)).not.toContain('#t=')
  })
})

describe('matchDurationSeconds', () => {
  it('reads the length off the frame count', () => {
    expect(matchDurationSeconds(match)).toBe(2_400)
  })

  it('is zero for a row the read freeze emptied', () => {
    expect(matchDurationSeconds(processingMatch)).toBe(0)
  })
})
