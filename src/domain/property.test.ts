import fc from 'fast-check'
import { runAutoAuction } from '@/domain/auction'
import { createInitialState } from '@/domain/generator'
import { resolveAuctionPolicy } from '@/domain/policy/resolver'
import { generateRoundRobinFixtures } from '@/domain/schedule'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'

describe('property checks', () => {
  it(
    'auction respects budget and squad caps for many seeds',
    () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), (seed) => {
        const state = createInitialState(seed)
        const next = runAutoAuction(state)
        const policy = resolveAuctionPolicy().policy
        const playerById = new Map(next.players.map((player) => [player.id, player]))

        return next.teams.every(
          (team) =>
            team.budgetRemaining >= 0 &&
            team.rosterPlayerIds.length >= policy.squadMin &&
            team.rosterPlayerIds.length <= policy.squadMax &&
            team.rosterPlayerIds.filter((playerId) => playerById.get(playerId)?.countryTag !== 'IN').length <= policy.overseasCap,
        )
      }),
      { numRuns: 20 },
    )
    },
    30_000,
  )

  it(
    'simulated matches keep wickets <= 10 and overs <= 20',
    () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5_000 }), (seed) => {
        let state = createInitialState(seed)
        state = runAutoAuction(state)
        state.fixtures = generateRoundRobinFixtures(state.teams)

        for (let i = 0; i < Math.min(6, state.fixtures.length); i += 1) {
          const result = simulateNextFixture(state)
          state = result.nextState
          for (const playedMatch of result.playedMatches) {
            if (playedMatch.innings) {
              for (const innings of playedMatch.innings) {
                if (innings.wickets > 10 || innings.overs > 20) {
                  return false
                }
              }
            }
          }
        }

        return true
      }),
      { numRuns: 20 },
    )
    },
    30_000,
  )
})
