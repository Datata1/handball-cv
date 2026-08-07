import { errorBodySchema, ZONE_ORDER } from '../schemas/common'
import {
  formationScenesSchema,
  formationSummaryListSchema,
} from '../schemas/formations'
import {
  goalsSchema,
  heatmapPointsSchema,
  matchListSchema,
  matchStatsSchema,
  playerStatSchema,
  scoreboardSchema,
  scoreboardSummarySchema,
} from '../schemas/matches'
import { attacksSchema, playSummaryListSchema, playsSchema } from '../schemas/plays'
import { teamPhasesSchema } from '../schemas/teamPhases'
import { outputVideoSchema } from '../schemas/upload'

import attacks from './fixtures/attacks.json'
import formationScenes from './fixtures/formation-scenes.json'
import formationSummary from './fixtures/formation-summary.json'
import goals from './fixtures/goals.json'
import heatmapPoints from './fixtures/heatmap-points.json'
import heatmapPointsPhase from './fixtures/heatmap-points-phase.json'
import matches from './fixtures/matches.json'
import matchesProcessing from './fixtures/matches-processing.json'
import playSummary from './fixtures/play-summary.json'
import plays from './fixtures/plays.json'
import scoreboard from './fixtures/scoreboard.json'
import scoreboardSummary from './fixtures/scoreboard-summary.json'
import stats from './fixtures/stats.json'
import teamPhases from './fixtures/team-phases.json'
import videoOutput from './fixtures/video-output.json'

// Every fixture in ./fixtures came off a live backend — see its README.
describe('schemas parse real responses', () => {
  it.each([
    ['GET /matches', matchListSchema, matches],
    ['GET /stats', matchStatsSchema, stats],
    ['GET /heatmap-points', heatmapPointsSchema, heatmapPoints],
    ['GET /heatmap-points (filtered)', heatmapPointsSchema, heatmapPointsPhase],
    ['GET /scoreboard', scoreboardSchema, scoreboard],
    ['GET /scoreboard/summary', scoreboardSummarySchema, scoreboardSummary],
    ['GET /goals', goalsSchema, goals],
    ['GET /formation-summary', formationSummaryListSchema, formationSummary],
    ['GET /formation-scenes', formationScenesSchema, formationScenes],
    ['GET /team-phases', teamPhasesSchema, teamPhases],
    ['GET /plays', playsSchema, plays],
    ['GET /play-summary', playSummaryListSchema, playSummary],
    ['GET /attacks', attacksSchema, attacks],
    ['GET /videos/{id}/output', outputVideoSchema, videoOutput],
  ])('%s', (_name, schema, fixture) => {
    expect(schema.safeParse(fixture)).toMatchObject({ success: true })
  })
})

describe('matchMetaSchema tolerates the shapes that break a strict schema', () => {
  // Captured while a match was ingesting. Note the healthy match degenerated
  // too — the read freeze empties the DuckDB query for every match at once.
  it('parses the degenerate rows served during the processing freeze', () => {
    const parsed = matchListSchema.parse(matchesProcessing)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({
      file_name: '',
      video_path: '',
      fps: 0,
      total_frames: 0,
      duration: null,
      ingested_at: null,
      display_name: null,
    })
    expect(parsed.map((m) => m.status)).toEqual(['done', 'processing'])
  })

  it('rejects an unknown status rather than passing it through', () => {
    const row = { ...matchListSchema.parse(matches)[0], status: 'queued' }

    expect(matchListSchema.safeParse([row]).success).toBe(false)
  })
})

describe('the three team domains stay separate', () => {
  it('keeps a raw track team next to a normalised point team', () => {
    const parsed = heatmapPointsSchema.parse(heatmapPoints)

    // Same response, same concept, two vocabularies: the SQL CASE normalises
    // the points but not the track list.
    expect(parsed.available_track_ids.map((t) => t.team)).toContain('unknown')
    for (const point of parsed.heatmap_points) {
      expect(['A', 'B', 'U']).toContain(point.team)
    }
  })

  it('accepts a null player_stats team', () => {
    const stat = {
      ...playerStatSchema.parse(matchStatsSchema.parse(stats).player_stats[0]),
    }

    expect(playerStatSchema.parse({ ...stat, team: null }).team).toBeNull()
  })

  it('accepts a raw goal team from /goals but not from the summary', () => {
    const [goal] = goalsSchema.parse(goals)
    const raw = { ...goal, team: 'A' }

    expect(goalsSchema.safeParse([raw]).success).toBe(true)
    expect(
      scoreboardSummarySchema.safeParse({
        ...scoreboardSummarySchema.parse(scoreboardSummary),
        goals: [raw],
      }).success,
    ).toBe(false)
  })
})

describe('stats zone arrays', () => {
  it('are six entries in ZONE_ORDER, with intensity on one and count on the other', () => {
    const parsed = matchStatsSchema.parse(stats)

    expect(parsed.heatmap_left.map((z) => z.zone)).toEqual([...ZONE_ORDER])
    expect(parsed.heatmap_left_by_team.A.map((z) => z.zone)).toEqual([...ZONE_ORDER])
    expect(parsed.heatmap_left[0]).toHaveProperty('intensity')
    expect(parsed.heatmap_left_by_team.A[0]).toHaveProperty('count')
  })

  it('rejects a five-zone array — a partial heatmap would silently misdraw', () => {
    const parsed = matchStatsSchema.parse(stats)
    const short = { ...parsed, heatmap_left: parsed.heatmap_left.slice(0, 5) }

    expect(matchStatsSchema.safeParse(short).success).toBe(false)
  })
})

describe('open label sets survive a value the frontend has never seen', () => {
  it('accepts a formation the classifier invented', () => {
    const [summary] = formationSummaryListSchema.parse(formationSummary)

    const next = formationSummaryListSchema.parse([
      {
        ...summary,
        formations: { '4-2-0-schwerpunkt': 12 },
        dominant: '4-2-0-schwerpunkt',
      },
    ])

    expect(next[0]?.formations).toEqual({ '4-2-0-schwerpunkt': 12 })
  })

  it('accepts an unknown play type', () => {
    const [play] = playsSchema.parse(plays)

    expect(
      playsSchema.parse([{ ...play, play_type: 'sperre_stossen' }])[0]?.play_type,
    ).toBe('sperre_stossen')
  })
})

describe('playEventSchema', () => {
  it('parses a play with trajectories and one with neither details nor label', () => {
    const parsed = playsSchema.parse(plays)

    expect(parsed[0]?.details).toMatchObject({ goal_x: expect.any(Number) })
    expect(parsed[0]?.label).toBe('correct')
    expect(parsed.at(-1)?.details).toBeNull()
    expect(parsed.at(-1)?.label).toBeNull()
  })

  // Databases predating the attack-sequence tables take a join-free query path.
  it('defaults the join-only fields to null when they are absent entirely', () => {
    const { sequence_id, outcome, label, ...legacy } = playsSchema.parse(plays)[0] ?? {}
    void [sequence_id, outcome, label]

    expect(playEventOf(legacy)).toMatchObject({
      sequence_id: null,
      outcome: null,
      label: null,
    })
  })
})

describe('play summary', () => {
  it('keeps success_rate null when no attack was rated', () => {
    const parsed = playSummaryListSchema.parse(playSummary)

    expect(parsed.some((p) => p.success_rate === null)).toBe(true)
  })
})

describe('errorBodySchema', () => {
  it('parses an HTTPException detail', () => {
    expect(errorBodySchema.parse({ detail: 'Match not found' }).detail).toBe(
      'Match not found',
    )
  })

  it('parses a 422 detail, ignoring the extra fields FastAPI adds', () => {
    const body = {
      detail: [
        {
          type: 'string_type',
          loc: ['body', 'display_name'],
          msg: 'Input should be a valid string',
          input: 5,
        },
      ],
    }

    expect(errorBodySchema.parse(body).detail).toEqual([
      {
        type: 'string_type',
        loc: ['body', 'display_name'],
        msg: 'Input should be a valid string',
      },
    ])
  })
})

function playEventOf(value: unknown) {
  return playsSchema.parse([value])[0]
}
