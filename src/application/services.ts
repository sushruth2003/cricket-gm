import type { GameRepository } from '@/application/gameRepository'
import { createLeague } from '@/application/useCases/createLeague'
import { exportSave } from '@/application/useCases/exportSave'
import { importSave } from '@/application/useCases/importSave'
import { runAuction } from '@/application/useCases/runAuction'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import { updateUserTeamSetup } from '@/application/useCases/updateUserTeamSetup'
import type { GameState } from '@/domain/types'
import { GameRepositoryImpl } from '@/infrastructure/repository/gameRepositoryImpl'
import { SqliteStore } from '@/infrastructure/repository/sqliteStore'
import { selectStorageAdapter } from '@/infrastructure/storage/storageFactory'

export interface AppServices {
  repository: GameRepository
  getState(): Promise<GameState | null>
  initialize(seed?: number): Promise<GameState>
  runAuction(): Promise<GameState>
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

export const createAppServices = async (): Promise<AppServices> => {
  const repository = await buildRepository()

  return {
    repository,
    getState: () => repository.load(),
    initialize: async (seed?: number) => {
      const existing = await repository.load()
      if (existing) {
        return existing
      }
      return createLeague(repository, seed)
    },
    runAuction: () => runAuction(repository),
    updateUserTeamSetup: (input) => updateUserTeamSetup(repository, input),
    simulateOneMatch: async () => {
      const state = await repository.load()
      if (!state) {
        throw new Error('No league loaded')
      }
      const { nextState } = simulateNextFixture(state)
      await repository.save(nextState)
      return nextState
    },
    simulateSeasonWithWorker: async ({ onProgress, signal }) => {
      const state = await repository.load()
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
            | { type: 'progress'; payload: { state: GameState; completedMatches: number; totalMatches: number } }
            | { type: 'complete'; payload: { state: GameState } }
            | { type: 'cancelled'; payload: { state: GameState } }

          if (message.type === 'progress') {
            onProgress(message.payload.state, message.payload.completedMatches, message.payload.totalMatches)
            return
          }

          if (message.type === 'complete') {
            await repository.save(message.payload.state)
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
