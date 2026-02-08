import { createInitialState } from '@/domain/generator'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

export const createLeague = async (repository: GameRepository, seed = Date.now() % 1_000_000_000): Promise<GameState> => {
  const state = createInitialState(seed)
  await repository.save(state)
  return state
}
