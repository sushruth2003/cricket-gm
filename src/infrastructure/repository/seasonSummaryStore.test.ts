import { createInitialState } from '@/domain/generator'
import { buildSeasonSummary } from '@/infrastructure/repository/seasonSummaryStore'

describe('buildSeasonSummary', () => {
  it('creates a compact per-season player descriptor', () => {
    const state = createInitialState(601)
    state.phase = 'complete'
    state.players = state.players.slice(0, 3)
    state.players[0].teamId = 'team-1'
    state.players[1].teamId = 'team-1'
    state.players[2].teamId = null
    state.stats = {
      [state.players[0].id]: {
        playerId: state.players[0].id,
        matches: 8,
        runs: 310,
        balls: 220,
        wickets: 2,
        overs: 0,
        runsConceded: 0,
      },
      [state.players[2].id]: {
        playerId: state.players[2].id,
        matches: 0,
        runs: 0,
        balls: 0,
        wickets: 0,
        overs: 0,
        runsConceded: 0,
      },
    }

    const summary = buildSeasonSummary(state)
    expect(summary.seed).toBe(state.metadata.seed)
    expect(summary.players).toHaveLength(2)

    const first = summary.players[0]
    expect(first.playerId).toBe(state.players[0].id)
    expect(first.performance.strikeRate).toBeCloseTo(140.91, 2)
    expect(first.performance.economy).toBe(0)
  })
})
