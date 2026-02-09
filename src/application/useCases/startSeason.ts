import { ValidationError } from '@/domain/errors'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

export const startSeason = async (repository: GameRepository, leagueId?: string): Promise<GameState> => {
  return repository.transaction(async (current) => {
    if (!current) {
      throw new ValidationError('No league loaded')
    }
    if (current.phase !== 'preseason') {
      throw new ValidationError('Season can only be started from preseason')
    }

    const next = structuredClone(current)
    next.phase = 'regular-season'
    next.metadata.updatedAt = new Date().toISOString()

    assertGameStateSemanticIntegrity(next)

    return {
      nextState: next,
      result: next,
    }
  }, leagueId)
}
