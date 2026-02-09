import type { GameRepository, LeagueSummary } from '@/application/gameRepository'
import type { GameState, LeagueSave } from '@/domain/types'

export class MemoryRepository implements GameRepository {
  private leagues: Record<string, LeagueSave> = {}
  private activeLeagueId: string | null = null
  private static readonly defaultSeasonId = 'season-1'
  private static readonly defaultSeasonName = 'Season 1'

  private selectLeague(leagueId?: string): LeagueSave | null {
    if (leagueId) {
      return this.leagues[leagueId] ?? null
    }
    if (this.activeLeagueId && this.leagues[this.activeLeagueId]) {
      return this.leagues[this.activeLeagueId]
    }
    const firstLeague = Object.values(this.leagues)[0]
    return firstLeague ?? null
  }

  async load(leagueId?: string): Promise<GameState | null> {
    const league = this.selectLeague(leagueId)
    if (!league) {
      return null
    }
    const season = league.seasons[league.activeSeasonId] ?? Object.values(league.seasons)[0] ?? null
    return season ? structuredClone(season.state) : null
  }

  async save(state: GameState, leagueId?: string): Promise<void> {
    const nowIso = new Date().toISOString()
    const targetLeagueId = leagueId ?? this.activeLeagueId ?? 'league-primary'
    const existing = this.leagues[targetLeagueId]

    if (!existing) {
      this.leagues[targetLeagueId] = {
        id: targetLeagueId,
        name: 'League 1',
        activeSeasonId: MemoryRepository.defaultSeasonId,
        seasons: {
          [MemoryRepository.defaultSeasonId]: {
            id: MemoryRepository.defaultSeasonId,
            name: MemoryRepository.defaultSeasonName,
            state: structuredClone(state),
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      this.activeLeagueId = targetLeagueId
      return
    }

    const currentSeasonId = existing.activeSeasonId
    const currentSeason = existing.seasons[currentSeasonId]
    existing.seasons[currentSeasonId] = {
      id: currentSeasonId,
      name: currentSeason?.name ?? MemoryRepository.defaultSeasonName,
      state: structuredClone(state),
      createdAt: currentSeason?.createdAt ?? nowIso,
      updatedAt: nowIso,
    }
    existing.updatedAt = nowIso
    this.activeLeagueId = targetLeagueId
  }

  async transaction<T>(run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>, leagueId?: string): Promise<T> {
    const snapshotLeagues = structuredClone(this.leagues)
    const snapshotActiveLeagueId = this.activeLeagueId

    try {
      const current = await this.load(leagueId)
      const outcome = await run(current ? structuredClone(current) : null)
      if (outcome.nextState) {
        await this.save(outcome.nextState, leagueId)
      }
      return outcome.result
    } catch (error) {
      this.leagues = snapshotLeagues
      this.activeLeagueId = snapshotActiveLeagueId
      throw error
    }
  }

  async listLeagues(): Promise<LeagueSummary[]> {
    return Object.values(this.leagues)
      .map((league) => ({
        id: league.id,
        name: league.name,
        activeSeasonId: league.activeSeasonId,
        seasonCount: Object.keys(league.seasons).length,
        updatedAt: league.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getActiveLeagueId(): Promise<string | null> {
    return this.activeLeagueId
  }

  async setActiveLeague(leagueId: string): Promise<void> {
    if (!this.leagues[leagueId]) {
      throw new Error(`League not found: ${leagueId}`)
    }
    this.activeLeagueId = leagueId
  }

  async createLeague(leagueId: string, leagueName: string, initialState: GameState): Promise<void> {
    if (this.leagues[leagueId]) {
      throw new Error(`League already exists: ${leagueId}`)
    }
    const nowIso = new Date().toISOString()
    this.leagues[leagueId] = {
      id: leagueId,
      name: leagueName,
      activeSeasonId: MemoryRepository.defaultSeasonId,
      seasons: {
        [MemoryRepository.defaultSeasonId]: {
          id: MemoryRepository.defaultSeasonId,
          name: MemoryRepository.defaultSeasonName,
          state: structuredClone(initialState),
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    this.activeLeagueId = leagueId
  }

  async createSeason(leagueId: string, seasonId: string, seasonName: string, seasonState: GameState): Promise<void> {
    const league = this.leagues[leagueId]
    if (!league) {
      throw new Error(`League not found: ${leagueId}`)
    }
    if (league.seasons[seasonId]) {
      throw new Error(`Season already exists: ${seasonId}`)
    }
    const nowIso = new Date().toISOString()
    league.seasons[seasonId] = {
      id: seasonId,
      name: seasonName,
      state: structuredClone(seasonState),
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    league.activeSeasonId = seasonId
    league.updatedAt = nowIso
    this.activeLeagueId = leagueId
  }

  async reset(leagueId?: string): Promise<void> {
    if (!leagueId) {
      this.leagues = {}
      this.activeLeagueId = null
      return
    }
    delete this.leagues[leagueId]
    if (this.activeLeagueId === leagueId) {
      this.activeLeagueId = Object.keys(this.leagues)[0] ?? null
    }
  }
}
