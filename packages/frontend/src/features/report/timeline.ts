import type { FormationScene, GoalEvent, PlayEvent, TeamPhase } from '@/shared/api'
import type { TimelineItem, TimelineTone, TimelineTrack } from '@/shared/video'

/**
 * What the report has fetched for the timeline. A field left `undefined` — the
 * query has not answered, or it failed — contributes **no track at all**: an
 * empty lane would claim the detector looked and found nothing.
 */
export interface TimelineSources {
  goals?: readonly GoalEvent[]
  phases?: readonly TeamPhase[]
  plays?: readonly PlayEvent[]
  formations?: readonly FormationScene[]
}

/**
 * Every string the tracks need, supplied by the caller.
 *
 * The builder stays pure and language-free: team names come from the match's
 * own meta and detector labels from `useBackendLabel`, neither of which belongs
 * in a module that only knows about intervals.
 */
export interface TimelineLabels {
  tracks: { goals: string; phases: string; plays: string; formations: string }
  goal: (goal: GoalEvent) => string
  phase: (phase: TeamPhase) => string
  play: (play: PlayEvent) => string
  formation: (scene: FormationScene) => string
}

/** Emphasis only — every item's accessible name already says whose it is. */
export function teamTone(team: string): TimelineTone {
  const code = team.toUpperCase()
  if (code === 'A') return 'teamA'

  return code === 'B' ? 'teamB' : 'unknown'
}

export function buildTimelineTracks(
  sources: TimelineSources,
  labels: TimelineLabels,
): TimelineTrack[] {
  const tracks: TimelineTrack[] = []

  if (sources.goals) {
    tracks.push({
      id: 'goals',
      label: labels.tracks.goals,
      kind: 'marker',
      items: sources.goals.map(
        (goal): TimelineItem => ({
          // Goals carry no id of their own, and the frame they were read at is
          // the one thing unique about them.
          id: `goal-${goal.frame_number}`,
          start: goal.timestamp_sec,
          label: labels.goal(goal),
          tone: 'event',
        }),
      ),
    })
  }

  if (sources.phases) {
    tracks.push({
      id: 'phases',
      label: labels.tracks.phases,
      kind: 'interval',
      items: sources.phases.map(
        (phase): TimelineItem => ({
          id: `phase-${phase.phase_id}`,
          start: phase.start_time_s,
          end: phase.end_time_s,
          label: labels.phase(phase),
          short: phase.offense_team.toUpperCase().slice(0, 2),
          tone: teamTone(phase.offense_team),
        }),
      ),
    })
  }

  if (sources.plays) {
    tracks.push({
      id: 'plays',
      label: labels.tracks.plays,
      kind: 'interval',
      items: sources.plays.map(
        (play): TimelineItem => ({
          id: `play-${play.event_id}`,
          start: play.start_time_s,
          end: play.end_time_s,
          label: labels.play(play),
          tone: teamTone(play.team),
        }),
      ),
    })
  }

  if (sources.formations) {
    tracks.push({
      id: 'formations',
      label: labels.tracks.formations,
      kind: 'interval',
      items: sources.formations.map(
        (scene): TimelineItem => ({
          id: `formation-${scene.scene_id}`,
          start: scene.start_time_s,
          end: scene.end_time_s,
          label: labels.formation(scene),
          short: scene.formation,
          tone: teamTone(scene.team),
        }),
      ),
    })
  }

  return tracks
}
