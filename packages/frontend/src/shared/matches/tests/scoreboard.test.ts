import type { ScoreboardSummary } from '@/shared/api'

import { finalScore } from '../scoreboard'

const summary: ScoreboardSummary = {
  match_id: 'seed01',
  final_score_home: 27,
  final_score_away: 24,
  final_game_time: '60:00',
  goals: [],
}

describe('finalScore', () => {
  it('reads the final score off the summary', () => {
    expect(finalScore(summary)).toEqual({ home: 27, away: 24 })
  })

  it('is null when the match has no scoreboard at all', () => {
    expect(finalScore(null)).toBeNull()
  })

  // Half a score is not a score: the OCR read one side's digits and not the
  // other, and a card showing "27:—" would look like a result.
  it('is null when either side was never read', () => {
    expect(finalScore({ ...summary, final_score_away: null })).toBeNull()
    expect(finalScore({ ...summary, final_score_home: null })).toBeNull()
  })
})
