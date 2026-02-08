import { runAutoAuction } from '@/domain/auction'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'
import { generateRoundRobinFixtures } from '@/domain/schedule'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

export const runAuction = async (repository: GameRepository): Promise<GameState> => {
  return repository.transaction(async (current) => {
    if (!current) {
      throw new Error('No league loaded')
    }

    const next = runAutoAuction(current)
    next.fixtures = generateRoundRobinFixtures(next.teams)
    next.metadata.updatedAt = new Date().toISOString()

    assertGameStateSemanticIntegrity(next)

    return { nextState: next, result: next }
  })
}
