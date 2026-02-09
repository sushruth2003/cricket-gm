import type { CreateSeasonInput, GameRepository, LeagueSnapshot } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

const DEFAULT_LEAGUE_ID = 'league-primary'
const DEFAULT_LEAGUE_NAME = 'League 1'
const DEFAULT_SEASON_ID = 'season-1'
const DEFAULT_SEASON_NAME = 'Season 1'

interface MemorySeason {
  id: string
  name: string
  state: GameState
  createdAt: string
  updatedAt: string
}

interface MemoryLeague {
  id: string
  name: string
  activeSeasonId: string
  seasons: Record<string, MemorySeason>
  createdAt: string
  updatedAt: string
}

interface MemoryRoot {
  activeLeagueId: string
  leagues: Record<string, MemoryLeague>
}

const nowIso = () => new Date().toISOString()

const clone = <T>(value: T): T => structuredClone(value)

const createLeague = (leagueId: string, state: GameState): MemoryLeague => {
  const createdAt = nowIso()
  return {
    id: leagueId,
    name: DEFAULT_LEAGUE_NAME,
    activeSeasonId: DEFAULT_SEASON_ID,
    seasons: {
      [DEFAULT_SEASON_ID]: {
        id: DEFAULT_SEASON_ID,
        name: DEFAULT_SEASON_NAME,
        state: clone(state),
        createdAt,
        updatedAt: createdAt,
      },
    },
    createdAt,
    updatedAt: createdAt,
  }
}

export class MemoryRepository implements GameRepository {
  private root: MemoryRoot | null = null

  private selectLeague(leagueId?: string): MemoryLeague | null {
    if (!this.root) {
      return null
    }

    if (leagueId) {
      return this.root.leagues[leagueId] ?? null
    }

    return this.root.leagues[this.root.activeLeagueId] ?? Object.values(this.root.leagues)[0] ?? null
  }

  async load(leagueId?: string): Promise<GameState | null> {
    const league = this.selectLeague(leagueId)
    if (!league) {
      return null
    }

    const season = league.seasons[league.activeSeasonId] ?? Object.values(league.seasons)[0] ?? null
    return season ? clone(season.state) : null
  }

  async save(state: GameState, leagueId?: string): Promise<void> {
    const targetLeagueId = leagueId ?? this.root?.activeLeagueId ?? DEFAULT_LEAGUE_ID

    if (!this.root) {
      this.root = {
        activeLeagueId: targetLeagueId,
        leagues: {
          [targetLeagueId]: createLeague(targetLeagueId, state),
        },
      }
      return
    }

    const league = this.root.leagues[targetLeagueId]
    if (!league) {
      this.root.leagues[targetLeagueId] = createLeague(targetLeagueId, state)
    } else {
      const season = league.seasons[league.activeSeasonId] ?? {
        id: league.activeSeasonId,
        name: DEFAULT_SEASON_NAME,
        state: clone(state),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }

      league.seasons[league.activeSeasonId] = {
        ...season,
        state: clone(state),
        updatedAt: nowIso(),
      }
      league.updatedAt = nowIso()
    }

    this.root.activeLeagueId = targetLeagueId
  }

  async getLeagueSnapshot(leagueId?: string): Promise<LeagueSnapshot | null> {
    const league = this.selectLeague(leagueId)
    if (!league) {
      return null
    }

    return {
      id: league.id,
      name: league.name,
      activeSeasonId: league.activeSeasonId,
      seasonIds: Object.keys(league.seasons).sort(),
      createdAt: league.createdAt,
      updatedAt: league.updatedAt,
    }
  }

  async createSeason(input: CreateSeasonInput): Promise<void> {
    if (!this.root) {
      throw new Error('No league loaded')
    }

    const targetLeagueId = input.leagueId ?? this.root.activeLeagueId
    const league = this.root.leagues[targetLeagueId]
    if (!league) {
      throw new Error('League not found')
    }

    if (league.activeSeasonId !== input.sourceSeasonId) {
      throw new Error('Season source mismatch')
    }

    if (!league.seasons[input.nextSeasonId]) {
      const createdAt = nowIso()
      league.seasons[input.nextSeasonId] = {
        id: input.nextSeasonId,
        name: input.nextSeasonName,
        state: clone(input.state),
        createdAt,
        updatedAt: createdAt,
      }
    }

    league.activeSeasonId = input.nextSeasonId
    league.updatedAt = nowIso()
    this.root.activeLeagueId = targetLeagueId
  }

  async transaction<T>(
    run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>,
    leagueId?: string,
  ): Promise<T> {
    const snapshot = this.root ? clone(this.root) : null

    try {
      const outcome = await run(await this.load(leagueId))
      if (outcome.nextState) {
        await this.save(outcome.nextState, leagueId)
      }
      return outcome.result
    } catch (error) {
      this.root = snapshot
      throw error
    }
  }

  async reset(leagueId?: string): Promise<void> {
    if (!leagueId) {
      this.root = null
      return
    }

    if (!this.root) {
      return
    }

    delete this.root.leagues[leagueId]
    if (!Object.keys(this.root.leagues).length) {
      this.root = null
      return
    }

    if (!this.root.leagues[this.root.activeLeagueId]) {
      this.root.activeLeagueId = Object.keys(this.root.leagues)[0]
    }
  }
}
