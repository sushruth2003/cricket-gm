import { runAutoAuction } from '@/domain/auction'
import { createInitialState } from '@/domain/generator'

describe('auction constraints', () => {
  it('never exceeds team budgets or max squad size', () => {
    const state = createInitialState(88)
    const next = runAutoAuction(state)
    const playerById = new Map(next.players.map((player) => [player.id, player]))

    for (const team of next.teams) {
      expect(team.budgetRemaining).toBeGreaterThanOrEqual(0)
      expect(team.rosterPlayerIds.length).toBeGreaterThanOrEqual(next.config.minSquadSize)
      expect(team.rosterPlayerIds.length).toBeLessThanOrEqual(next.config.maxSquadSize)
      const overseas = team.rosterPlayerIds.filter((playerId) => playerById.get(playerId)?.countryTag !== 'IN').length
      expect(overseas).toBeLessThanOrEqual(8)
      expect(next.config.auctionBudget - team.budgetRemaining).toBeGreaterThanOrEqual(9_000)
    }
  })
})
