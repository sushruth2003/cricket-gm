import { createSeededInitialStateWithOptions } from '@/domain/generator'
import { simulateMatch } from '@/domain/matchSim'

describe('match simulation scorecard details', () => {
  it('lists batters in the order they came in and annotates dismissals', () => {
    const state = createSeededInitialStateWithOptions(8842, {
      seasonStartIso: '2025-01-01T00:00:00.000Z',
      policyContext: {
        policySet: 'ipl-2025-cycle',
        seasonYear: 2025,
      },
    })

    const fixture = state.fixtures[0]
    const result = simulateMatch(state, fixture, 7)
    expect(result.innings).not.toBeNull()

    for (const innings of result.innings ?? []) {
      const battingTeam = state.teams.find((team) => team.id === innings.battingTeamId)
      expect(battingTeam).toBeTruthy()
      if (!battingTeam) {
        continue
      }

      const battingOrder = innings.batting.map((line) => line.playerId)
      expect(battingOrder).toEqual(battingTeam.playingXi.slice(0, battingOrder.length))

      for (const line of innings.batting) {
        if (!line.out) {
          continue
        }

        expect(line.dismissalKind).not.toBeNull()
        expect(line.dismissedByPlayerId).toBeTruthy()

        if (line.dismissalKind === 'caught') {
          expect(line.assistedByPlayerId).toBeTruthy()
        }
      }

      const bowlerWickets = innings.bowling.reduce((sum, line) => sum + line.wickets, 0)
      const creditedBowlerDismissals = innings.batting.filter(
        (line) => line.out && line.dismissalKind && line.dismissalKind !== 'run-out',
      ).length
      expect(bowlerWickets).toBe(creditedBowlerDismissals)
    }
  })
})
