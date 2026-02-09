import type { GameState } from '@/domain/types'

export interface LeagueSummary {
  id: string
  name: string
  activeSeasonId: string
  seasonCount: number
  updatedAt: string
}

export interface GameRepository {
  load(leagueId?: string): Promise<GameState | null>
  save(state: GameState, leagueId?: string): Promise<void>
  transaction<T>(run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>, leagueId?: string): Promise<T>
  listLeagues(): Promise<LeagueSummary[]>
  getActiveLeagueId(): Promise<string | null>
  setActiveLeague(leagueId: string): Promise<void>
  createLeague(leagueId: string, leagueName: string, initialState: GameState): Promise<void>
  createSeason(
    leagueId: string,
    seasonId: string,
    seasonName: string,
    seasonState: GameState,
  ): Promise<void>
  reset(leagueId?: string): Promise<void>
}
