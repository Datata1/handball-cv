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

/**
 * The timeline ids of the three things a section can point at.
 *
 * Exported because defense, offense and the heatmap highlight items they did not
 * draw: they have to name them exactly as the builder below does.
 */
export function formationItemId(sceneId: number): string {
  return `formation-${sceneId}`
}

export function playItemId(eventId: number): string {
  return `play-${eventId}`
}

export function phaseItemId(phaseId: number): string {
  return `phase-${phaseId}`
}

/**
 * The phase a timeline item names, or `null` for an item that is not one.
 *
 * The heatmap reads the selection in this direction: the timeline is its phase
 * picker, and a click on a goal or a play must leave its filter alone rather
 * than register as "no phase".
 */
export function phaseIdFromItem(itemId: string | null): number | null {
  const id =
    itemId?.startsWith('phase-') === true ? Number(itemId.slice(6)) : Number.NaN

  return Number.isInteger(id) ? id : null
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
          id: phaseItemId(phase.phase_id),
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
          id: playItemId(play.event_id),
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
          id: formationItemId(scene.scene_id),
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
