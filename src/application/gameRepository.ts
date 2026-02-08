import type { GameState } from '@/domain/types'

export interface GameRepository {
  load(): Promise<GameState | null>
  save(state: GameState): Promise<void>
  transaction<T>(run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>): Promise<T>
  reset(): Promise<void>
}
