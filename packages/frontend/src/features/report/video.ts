import { type MatchMeta, matchVideoUrl, type OutputVideo } from '@/shared/api'
import type { VideoSource } from '@/stores'

/**
 * Whether the annotated render can be played, is still being made, or was never
 * asked for — `annotate_video=false` at upload leaves a `done` match without one.
 */
export type AnnotatedState = 'ready' | 'processing' | 'absent'

export function annotatedState(output: OutputVideo | undefined): AnnotatedState {
  if (output === undefined) return 'absent'
  if (output.status === 'ready') return 'ready'

  return output.status === 'processing' ? 'processing' : 'absent'
}

/**
 * The `src` for the report player.
 *
 * `resumeAt` is a media fragment, not a query parameter: the browser starts the
 * new file at that position and the server never sees it. It is what keeps the
 * playhead where it was when the source toggle swaps the file under the
 * element, which otherwise reloads from zero.
 */
export function videoSrc(
  matchId: string,
  source: VideoSource,
  resumeAt: number | null = null,
): string {
  const url = matchVideoUrl(matchId, source)

  return resumeAt !== null && resumeAt > 0 ? `${url}#t=${resumeAt.toFixed(1)}` : url
}

/**
 * How long the match runs, in seconds — the scale the timeline places items
 * against.
 *
 * `0` for a match whose row the read freeze emptied; the player's own metadata
 * is the only other source, and the timeline falls back to it.
 */
export function matchDurationSeconds(match: MatchMeta): number {
  return match.fps > 0 && match.total_frames > 0 ? match.total_frames / match.fps : 0
}
