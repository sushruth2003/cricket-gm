import fc from 'fast-check'
import { runAutoAuction } from '@/domain/auction'
import { createInitialState } from '@/domain/generator'
import { generateRoundRobinFixtures } from '@/domain/schedule'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'

describe('property checks', () => {
  it(
    'auction keeps budgets non-negative, roster bounds, and overseas caps across many seeds',
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 50_000 }), (seed) => {
          const state = createInitialState(seed)
          const next = runAutoAuction(state)
          const playerById = new Map(next.players.map((player) => [player.id, player]))

          return next.teams.every((team) => {
            const overseasCount = team.rosterPlayerIds.filter((playerId) => playerById.get(playerId)?.countryTag !== 'IN').length
            return (
              team.budgetRemaining >= 0 &&
              team.rosterPlayerIds.length >= next.config.minSquadSize &&
              team.rosterPlayerIds.length <= next.config.maxSquadSize &&
              overseasCount <= 8
            )
          })
        }),
        { numRuns: 75 },
      )
    },
    45_000,
  )

  it(
    'runAutoAuction is deterministic for repeated execution from identical initial states',
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 25_000 }), (seed) => {
          const initial = createInitialState(seed)
          const one = runAutoAuction(initial)
          const two = runAutoAuction(initial)
          const signature = (state: typeof one) =>
            JSON.stringify({
              seed: state.metadata.seed,
              phase: state.phase,
              teamBudgets: state.teams.map((team) => team.budgetRemaining),
              teamRosters: state.teams.map((team) => team.rosterPlayerIds),
              soldEntries: state.auction.entries
                .filter((entry) => entry.status === 'sold')
                .map((entry) => [entry.playerId, entry.soldToTeamId, entry.finalPrice]),
            })
          return signature(one) === signature(two)
        }),
        { numRuns: 20 },
      )
    },
    25_000,
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
