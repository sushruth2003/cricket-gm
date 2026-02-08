import { runAutoAuction } from '@/domain/auction'
import { createInitialState } from '@/domain/generator'

describe('auction constraints', () => {
  it('never exceeds team budgets or max squad size', () => {
    const state = createInitialState(88)
    const next = runAutoAuction(state)

    for (const team of next.teams) {
      expect(team.budgetRemaining).toBeGreaterThanOrEqual(0)
      expect(team.rosterPlayerIds.length).toBeLessThanOrEqual(next.config.maxSquadSize)
    }
  })
})
