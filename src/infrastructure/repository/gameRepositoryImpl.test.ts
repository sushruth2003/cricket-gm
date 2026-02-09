import { createInitialState } from '@/domain/generator'
import { gameSaveRootV3Schema } from '@/application/contracts'
import { GameRepositoryImpl } from '@/infrastructure/repository/gameRepositoryImpl'
import type { SqliteStore } from '@/infrastructure/repository/sqliteStore'

const SAVE_ID = 'primary'

class StoreDouble {
  private readonly map = new Map<string, string>()

  seed(id: string, payload: string) {
    this.map.set(id, payload)
  }

  read(id: string): string | null {
    return this.map.get(id) ?? null
  }

  listKeys(): string[] {
    return [...this.map.keys()]
  }

  async readState(id: string): Promise<string | null> {
    return this.read(id)
  }

  async writeState(id: string, payload: string): Promise<void> {
    this.map.set(id, payload)
  }

  async clearState(id: string): Promise<void> {
    this.map.delete(id)
  }
}

const createRepository = (store: StoreDouble) => new GameRepositoryImpl(store as unknown as SqliteStore)

const readRoot = (store: StoreDouble) => {
  const payload = store.read(SAVE_ID)
  expect(payload).toBeTruthy()
  return JSON.parse(payload ?? '{}') as unknown
}

describe('GameRepositoryImpl', () => {
  it('migrates a v2 payload into v3 multi-league structure', async () => {
    const store = new StoreDouble()
    const legacy = createInitialState(1201)
    store.seed(SAVE_ID, JSON.stringify(legacy))

    const repository = createRepository(store)
    const loaded = await repository.load()
    const snapshot = await repository.getLeagueSnapshot()

    expect(loaded?.metadata.seed).toBe(1201)
    expect(snapshot).toMatchObject({
      id: 'league-primary',
      activeSeasonId: 'season-1',
      seasonIds: ['season-1'],
    })

    const parsed = gameSaveRootV3Schema.safeParse(readRoot(store))
    expect(parsed.success).toBe(true)
    expect(parsed.success ? Object.keys(parsed.data.leagues) : []).toEqual(['league-primary'])
  })

  it('quarantines unrecoverable legacy payloads and clears primary slot', async () => {
    const store = new StoreDouble()
    store.seed(SAVE_ID, JSON.stringify('corrupt-save'))

    const repository = createRepository(store)
    const loaded = await repository.load()

    expect(loaded).toBeNull()
    expect(store.read(SAVE_ID)).toBeNull()

    const backupKey = store.listKeys().find((key) => key.startsWith('primary-corrupt-'))
    expect(backupKey).toBeDefined()
    expect(backupKey ? store.read(backupKey) : null).toBe(JSON.stringify('corrupt-save'))
  })

  it('isolates save/load paths per league with no cross-league state bleed', async () => {
    const store = new StoreDouble()
    const repository = createRepository(store)
    const leagueA = createInitialState(2001)
    const leagueB = createInitialState(2002)

    await repository.save(leagueA, 'league-a')
    await repository.save(leagueB, 'league-b')

    const loadedA = await repository.load('league-a')
    const loadedB = await repository.load('league-b')
    const defaultLoaded = await repository.load()

    expect(loadedA?.metadata.seed).toBe(2001)
    expect(loadedB?.metadata.seed).toBe(2002)
    expect(defaultLoaded?.metadata.seed).toBe(2002)

    const mutatedA = structuredClone(loadedA)
    expect(mutatedA).not.toBeNull()
    if (!mutatedA) {
      throw new Error('league-a should be available')
    }

    mutatedA.teams[0].points = 99
    await repository.save(mutatedA, 'league-a')

    const afterB = await repository.load('league-b')
    expect(afterB?.teams[0].points).toBe(leagueB.teams[0].points)
  })

  it('creates a season on one league without mutating other league timelines', async () => {
    const store = new StoreDouble()
    const repository = createRepository(store)
    const leagueA = createInitialState(3101)
    const leagueB = createInitialState(3102)

    await repository.save(leagueA, 'league-a')
    await repository.save(leagueB, 'league-b')

    const seasonTwoState = createInitialState(4101)
    await repository.createSeason({
      leagueId: 'league-a',
      sourceSeasonId: 'season-1',
      nextSeasonId: 'season-2',
      nextSeasonName: 'Season 2',
      state: seasonTwoState,
    })

    const snapshotA = await repository.getLeagueSnapshot('league-a')
    const snapshotB = await repository.getLeagueSnapshot('league-b')
    const activeA = await repository.load('league-a')
    const activeB = await repository.load('league-b')

    expect(snapshotA).toMatchObject({ activeSeasonId: 'season-2', seasonIds: ['season-1', 'season-2'] })
    expect(snapshotB).toMatchObject({ activeSeasonId: 'season-1', seasonIds: ['season-1'] })
    expect(activeA?.metadata.seed).toBe(4101)
    expect(activeB?.metadata.seed).toBe(3102)
  })

  it('rolls back whole-root mutations when a transaction fails', async () => {
    const store = new StoreDouble()
    const repository = createRepository(store)
    const leagueA = createInitialState(5001)
    const leagueB = createInitialState(5002)

    await repository.save(leagueA, 'league-a')
    await repository.save(leagueB, 'league-b')
    const before = store.read(SAVE_ID)

    await expect(
      repository.transaction(async () => {
        const overwrittenB = createInitialState(9001)
        await repository.save(overwrittenB, 'league-b')
        throw new Error('forced-failure')
      }, 'league-a'),
    ).rejects.toThrow('forced-failure')

    const after = store.read(SAVE_ID)
    const finalA = await repository.load('league-a')
    const finalB = await repository.load('league-b')

    expect(after).toBe(before)
    expect(finalA?.metadata.seed).toBe(5001)
    expect(finalB?.metadata.seed).toBe(5002)
  })

  it('returns null for missing league snapshots and missing league loads', async () => {
    const store = new StoreDouble()
    const repository = createRepository(store)
    await repository.save(createInitialState(7001), 'league-a')

    await expect(repository.load('league-missing')).resolves.toBeNull()
    await expect(repository.getLeagueSnapshot('league-missing')).resolves.toBeNull()
  })
})
