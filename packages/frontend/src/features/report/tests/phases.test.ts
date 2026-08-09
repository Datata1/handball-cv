import type { TeamPhase } from '@/shared/api'

import { phaseAt } from '../phases'
import { phases } from '../stories/report'

describe('phaseAt', () => {
  it('finds the phase the playhead is inside', () => {
    expect(phaseAt(phases, 130)?.phase_id).toBe(1)
    expect(phaseAt(phases, 400)?.phase_id).toBe(2)
    expect(phaseAt(phases, 947.9)?.phase_id).toBe(3)
  })

  it('includes the first frame of a phase and excludes its last', () => {
    expect(phaseAt(phases, 120)?.phase_id).toBe(1)
    expect(phaseAt(phases, 141)).toBeNull()
  })

  it('is null in the gaps, which is where the transition badge comes from', () => {
    expect(phaseAt(phases, 0)).toBeNull()
    expect(phaseAt(phases, 300)).toBeNull()
    expect(phaseAt(phases, 2_000)).toBeNull()
  })

  it('has nothing to find in a match that was never scored', () => {
    expect(phaseAt([], 130)).toBeNull()
  })

  // The binary search is the point: a 90-minute match has thousands of phases
  // and this runs against the playhead.
  it('finds a phase in a long match without scanning it', () => {
    const many: TeamPhase[] = Array.from({ length: 5_000 }, (_, index) => ({
      phase_id: index,
      offense_team: 'A',
      defense_team: 'B',
      phase_type: 'attack',
      start_frame: index * 250,
      end_frame: index * 250 + 150,
      start_time_s: index * 10,
      end_time_s: index * 10 + 6,
    }))

    expect(phaseAt(many, 49_995)?.phase_id).toBe(4_999)
    expect(phaseAt(many, 49_999)).toBeNull()
  })
})
