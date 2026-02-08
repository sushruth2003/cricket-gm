import fc from 'fast-check'
import { runAutoAuction } from '@/domain/auction'
import { createInitialState } from '@/domain/generator'
import { generateRoundRobinFixtures } from '@/domain/schedule'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'

describe('property checks', () => {
  it('auction respects budget and squad caps for many seeds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), (seed) => {
        const state = createInitialState(seed)
        const next = runAutoAuction(state)

        return next.teams.every(
          (team) => team.budgetRemaining >= 0 && team.rosterPlayerIds.length <= next.config.maxSquadSize,
        )
      }),
    )
  })

  it('simulated matches keep wickets <= 10 and overs <= 20', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5_000 }), (seed) => {
        let state = createInitialState(seed)
        state = runAutoAuction(state)
        state.fixtures = generateRoundRobinFixtures(state.teams)

        for (let i = 0; i < Math.min(6, state.fixtures.length); i += 1) {
          const result = simulateNextFixture(state)
          state = result.nextState
          if (result.playedMatch?.innings) {
            for (const innings of result.playedMatch.innings) {
              if (innings.wickets > 10 || innings.overs > 20) {
                return false
              }
            }
          }
        }

        return true
      }),
    )
  })
})
