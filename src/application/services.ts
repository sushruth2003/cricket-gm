import type { GameRepository } from '@/application/gameRepository'
import type { LeagueSnapshot } from '@/application/gameRepository'
import { createLeague as createLeagueUseCase } from '@/application/useCases/createLeague'
import { exportSave } from '@/application/useCases/exportSave'
import { importSave } from '@/application/useCases/importSave'
import { progressAuctionForUser, runAuction } from '@/application/useCases/runAuction'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import { updateUserTeamSetup } from '@/application/useCases/updateUserTeamSetup'
import { createInitialState } from '@/domain/generator'
import type { GameState } from '@/domain/types'
import { GameRepositoryImpl } from '@/infrastructure/repository/gameRepositoryImpl'
import { SqliteStore } from '@/infrastructure/repository/sqliteStore'
import { selectStorageAdapter } from '@/infrastructure/storage/storageFactory'

export interface LeagueSummary {
  id: string
  name: string
  activeSeasonId: string
  seasonIds: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateLeagueInput {
  id?: string
  name?: string
  seed?: number
}

export interface AppServices {
  repository: GameRepository
  getState(leagueId?: string): Promise<GameState | null>
  listLeagues?(): Promise<LeagueSummary[]>
  getActiveLeagueId?(): Promise<string | null>
  createLeague?(input?: CreateLeagueInput): Promise<{ league: LeagueSummary; state: GameState }>
  selectLeague?(leagueId: string): Promise<GameState>
  initialize(seed?: number): Promise<GameState>
  runAuction(): Promise<GameState>
  auctionBid(): Promise<GameState>
  auctionPass(): Promise<GameState>
  auctionAuto(): Promise<GameState>
  updateUserTeamSetup(input: {
    playingXi: string[]
    wicketkeeperPlayerId: string
    bowlingPreset: 'balanced' | 'aggressive' | 'defensive'
  }): Promise<GameState>
  simulateOneMatch(): Promise<GameState>
  simulateSeasonWithWorker(params: {
    onProgress: (state: GameState, completed: number, total: number) => void
    signal?: AbortSignal
  }): Promise<GameState>
  exportSave(): Promise<string>
  importSave(raw: string): Promise<GameState>
}

const buildRepository = async (): Promise<GameRepository> => {
  const selected = await selectStorageAdapter()
  console.info('[storage] selected adapter', selected.adapter.name, 'chain', selected.fallbackChain.join(' -> '))
  const sqlite = new SqliteStore(selected.adapter)
  return new GameRepositoryImpl(sqlite)
}

const toLeagueSummary = (snapshot: LeagueSnapshot): LeagueSummary => ({
  id: snapshot.id,
  name: snapshot.name,
  activeSeasonId: snapshot.activeSeasonId,
  seasonIds: snapshot.seasonIds,
  createdAt: snapshot.createdAt,
  updatedAt: snapshot.updatedAt,
})

export const createAppServices = async (): Promise<AppServices> => {
  const repository = await buildRepository()
  let activeLeagueId: string | null = null

  const resolveActiveLeagueId = async (): Promise<string | null> => {
    if (activeLeagueId) {
      return activeLeagueId
    }
    const snapshot = await repository.getLeagueSnapshot()
    activeLeagueId = snapshot?.id ?? null
    return activeLeagueId
  }

  const loadState = async (leagueId?: string): Promise<GameState | null> => {
    const targetLeagueId = leagueId ?? (await resolveActiveLeagueId()) ?? undefined
    return repository.load(targetLeagueId)
  }

  return {
    repository,
    getState: (leagueId?: string) => loadState(leagueId),
    listLeagues: async () => {
      const repositoryWithList = repository as GameRepository & {
        listLeagueSnapshots?: () => Promise<LeagueSnapshot[]>
      }
      if (typeof repositoryWithList.listLeagueSnapshots === 'function') {
        const snapshots = await repositoryWithList.listLeagueSnapshots()
        return snapshots.map(toLeagueSummary)
      }
      const snapshot = await repository.getLeagueSnapshot()
      return snapshot ? [toLeagueSummary(snapshot)] : []
    },
    getActiveLeagueId: () => resolveActiveLeagueId(),
    createLeague: async (input?: CreateLeagueInput) => {
      const generatedId = input?.id?.trim() || `league-${Date.now().toString(36)}`
      const state = createInitialState(input?.seed ?? Date.now() % 1_000_000_000)
      await repository.save(state, generatedId)
      activeLeagueId = generatedId
      const snapshot = await repository.getLeagueSnapshot(generatedId)
      const league = snapshot
        ? toLeagueSummary(snapshot)
        : {
            id: generatedId,
            name: input?.name?.trim() || generatedId,
            activeSeasonId: 'season-1',
            seasonIds: ['season-1'],
            createdAt: state.metadata.createdAt,
            updatedAt: state.metadata.updatedAt,
          }
      return { league, state }
    },
    selectLeague: async (leagueId: string) => {
      const state = await repository.load(leagueId)
      if (!state) {
        throw new Error(`League ${leagueId} not found`)
      }
      await repository.save(state, leagueId)
      activeLeagueId = leagueId
      return state
    },
    initialize: async (seed?: number) => {
      const existing = await loadState()
      if (existing) {
        return existing
      }
      const created = await createLeagueUseCase(repository, seed)
      const snapshot = await repository.getLeagueSnapshot()
      activeLeagueId = snapshot?.id ?? activeLeagueId
      return created
    },
    runAuction: () => runAuction(repository),
    auctionBid: () => progressAuctionForUser(repository, 'bid'),
    auctionPass: () => progressAuctionForUser(repository, 'pass'),
    auctionAuto: () => progressAuctionForUser(repository, 'auto'),
    updateUserTeamSetup: (input) => updateUserTeamSetup(repository, input),
    simulateOneMatch: async () => {
      const state = await loadState()
      if (!state) {
        throw new Error('No league loaded')
      }
      const { nextState } = simulateNextFixture(state)
      await repository.save(nextState, (await resolveActiveLeagueId()) ?? undefined)
      return nextState
    },
    simulateSeasonWithWorker: async ({ onProgress, signal }) => {
      const state = await loadState()
      if (!state) {
        throw new Error('No league loaded')
      }

      return new Promise<GameState>((resolve, reject) => {
        const worker = new Worker(new URL('@/workers/seasonWorker.ts', import.meta.url), { type: 'module' })

        const cleanup = () => {
          worker.terminate()
        }

        const abortHandler = () => {
          worker.postMessage({ type: 'cancel' })
        }

        signal?.addEventListener('abort', abortHandler)

        worker.onmessage = async (event) => {
          const message = event.data as
            | {
                type: 'progress'
                payload: { state: GameState; completedMatches: number; totalMatches: number; simulatedDate: string | null }
              }
            | { type: 'complete'; payload: { state: GameState } }
            | { type: 'cancelled'; payload: { state: GameState } }

          if (message.type === 'progress') {
            onProgress(message.payload.state, message.payload.completedMatches, message.payload.totalMatches)
            return
          }

          if (message.type === 'complete') {
            await repository.save(message.payload.state, (await resolveActiveLeagueId()) ?? undefined)
            signal?.removeEventListener('abort', abortHandler)
            cleanup()
            resolve(message.payload.state)
            return
          }

          signal?.removeEventListener('abort', abortHandler)
          cleanup()
          reject(new Error('Season simulation cancelled'))
        }

        worker.onerror = (event) => {
          signal?.removeEventListener('abort', abortHandler)
          cleanup()
          reject(event.error ?? new Error('Season simulation worker failed'))
        }

        worker.postMessage({ type: 'start', payload: { state } })
      })
    },
    exportSave: () => exportSave(repository),
    importSave: (raw: string) => importSave(repository, raw),
  }
}
