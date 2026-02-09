import { createInitialState } from '@/domain/generator'
import { GameRepositoryImpl } from '@/infrastructure/repository/gameRepositoryImpl'
import type { SqliteStore } from '@/infrastructure/repository/sqliteStore'

class InMemorySqliteStore {
  private readonly saves = new Map<string, string>()

  async readState(id: string): Promise<string | null> {
    return this.saves.get(id) ?? null
  }

  async writeState(id: string, payload: string): Promise<void> {
    this.saves.set(id, payload)
  }

  async clearState(id: string): Promise<void> {
    this.saves.delete(id)
  }
}

describe('GameRepositoryImpl', () => {
  it('migrates v2 single-league saves to v3 root envelope on load', async () => {
    const store = new InMemorySqliteStore()
    const legacyState = createInitialState(2026)
    await store.writeState('primary', JSON.stringify(legacyState))

    const repository = new GameRepositoryImpl(store as unknown as SqliteStore)
    const loaded = await repository.load()

    expect(loaded).not.toBeNull()
    expect(loaded?.metadata.seed).toBe(2026)

    const persisted = JSON.parse((await store.readState('primary')) ?? '{}') as {
      metadata?: { schemaVersion?: number }
      activeLeagueId?: string
      leagues?: Record<string, unknown>
    }
    expect(persisted.metadata?.schemaVersion).toBe(3)
    expect(typeof persisted.activeLeagueId).toBe('string')
    expect(persisted.leagues).toBeDefined()
    expect(Object.keys(persisted.leagues ?? {})).toHaveLength(1)
  })

  it('supports saving and loading separate leagues independently', async () => {
    const store = new InMemorySqliteStore()
    const repository = new GameRepositoryImpl(store as unknown as SqliteStore)

    await repository.save(createInitialState(1001), 'league-a')
    await repository.save(createInitialState(2002), 'league-b')

    const leagueA = await repository.load('league-a')
    const leagueB = await repository.load('league-b')
    const current = await repository.load()

    expect(leagueA?.metadata.seed).toBe(1001)
    expect(leagueB?.metadata.seed).toBe(2002)
    expect(current?.metadata.seed).toBe(2002)
  })

  it('resets a single league without deleting other leagues', async () => {
    const store = new InMemorySqliteStore()
    const repository = new GameRepositoryImpl(store as unknown as SqliteStore)

    await repository.save(createInitialState(3003), 'league-a')
    await repository.save(createInitialState(4004), 'league-b')

    await repository.reset('league-a')

    const leagueA = await repository.load('league-a')
    const leagueB = await repository.load('league-b')
    expect(leagueA).toBeNull()
    expect(leagueB?.metadata.seed).toBe(4004)
  })

  it('lists leagues and supports explicit active league switching', async () => {
    const store = new InMemorySqliteStore()
    const repository = new GameRepositoryImpl(store as unknown as SqliteStore)

    await repository.save(createInitialState(5005), 'league-a')
    await repository.save(createInitialState(6006), 'league-b')

    const leagues = await repository.listLeagues()
    expect(leagues.map((league) => league.id).sort()).toEqual(['league-a', 'league-b'])
    expect(await repository.getActiveLeagueId()).toBe('league-b')

    await repository.setActiveLeague('league-a')

    expect(await repository.getActiveLeagueId()).toBe('league-a')
    const active = await repository.load()
    expect(active?.metadata.seed).toBe(5005)
  })
})
