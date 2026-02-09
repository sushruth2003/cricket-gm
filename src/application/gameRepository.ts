import type { GameState } from '@/domain/types'

export interface GameRepository {
  load(leagueId?: string): Promise<GameState | null>
  save(state: GameState, leagueId?: string): Promise<void>
  transaction<T>(run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>, leagueId?: string): Promise<T>
  reset(leagueId?: string): Promise<void>
}
