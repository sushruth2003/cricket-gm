import type { GameRepository } from '@/application/gameRepository'
import type { LeagueSummary } from '@/application/gameRepository'
import { advanceSeason } from '@/application/useCases/advanceSeason'
import { createLeague } from '@/application/useCases/createLeague'
import { exportSave } from '@/application/useCases/exportSave'
import { importSave } from '@/application/useCases/importSave'
import { progressAuctionForUser, runAuction } from '@/application/useCases/runAuction'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import { startSeason } from '@/application/useCases/startSeason'
import { updateUserTeamSetup } from '@/application/useCases/updateUserTeamSetup'
import type { GameState } from '@/domain/types'
import { GameRepositoryImpl } from '@/infrastructure/repository/gameRepositoryImpl'
import { SqliteStore } from '@/infrastructure/repository/sqliteStore'
import { selectStorageAdapter } from '@/infrastructure/storage/storageFactory'

export interface AppServices {
  repository: GameRepository
  getState(leagueId?: string): Promise<GameState | null>
  listLeagues(): Promise<LeagueSummary[]>
  getActiveLeagueId(): Promise<string | null>
  initialize(seed?: number): Promise<GameState>
  createLeague(input?: { seed?: number; name?: string }): Promise<GameState>
  selectLeague(leagueId: string): Promise<GameState>
  runAuction(leagueId?: string): Promise<GameState>
  auctionBid(leagueId?: string): Promise<GameState>
  auctionPass(leagueId?: string): Promise<GameState>
  auctionAuto(leagueId?: string): Promise<GameState>
  startSeason(leagueId?: string): Promise<GameState>
  updateUserTeamSetup(input: {
    playingXi: string[]
    wicketkeeperPlayerId: string
    bowlingPreset: 'balanced' | 'aggressive' | 'defensive'
  }, leagueId?: string): Promise<GameState>
  simulateOneMatch(leagueId?: string): Promise<GameState>
  simulateSeasonWithWorker(params: {
    onProgress: (state: GameState, completed: number, total: number) => void
    signal?: AbortSignal
    leagueId?: string
  }): Promise<GameState>
  advanceSeason(leagueId?: string): Promise<GameState>
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
    getState: (leagueId?: string) => repository.load(leagueId),
    listLeagues: () => repository.listLeagues(),
    getActiveLeagueId: () => repository.getActiveLeagueId(),
    initialize: async (seed?: number) => {
      const existing = await repository.load()
      if (existing) {
        return existing
      }
      return createLeague(repository, seed)
    },
    createLeague: async (input?: { seed?: number; name?: string }) => {
      const leagueName = input?.name?.trim().length ? input.name.trim() : `League ${Date.now().toString().slice(-4)}`
      const leagueId = `league-${Date.now().toString(36)}`
      return createLeague(repository, input?.seed, { leagueId, leagueName })
    },
    selectLeague: async (leagueId: string) => {
      await repository.setActiveLeague(leagueId)
      const loaded = await repository.load(leagueId)
      if (!loaded) {
        throw new Error(`League not found: ${leagueId}`)
      }
      return loaded
    },
    runAuction: (leagueId?: string) => runAuction(repository, leagueId),
    auctionBid: (leagueId?: string) => progressAuctionForUser(repository, 'bid', leagueId),
    auctionPass: (leagueId?: string) => progressAuctionForUser(repository, 'pass', leagueId),
    auctionAuto: (leagueId?: string) => progressAuctionForUser(repository, 'auto', leagueId),
    startSeason: (leagueId?: string) => startSeason(repository, leagueId),
    updateUserTeamSetup: (input, leagueId?: string) => updateUserTeamSetup(repository, input, leagueId),
    simulateOneMatch: async (leagueId?: string) => {
      const state = await repository.load(leagueId)
      if (!state) {
        throw new Error('No league loaded')
      }
      if (state.phase === 'auction' || state.phase === 'preseason') {
        throw new Error('Season simulation is unavailable before regular season starts')
      }
      const { nextState } = simulateNextFixture(state)
      await repository.save(nextState, leagueId)
      return nextState
    },
    simulateSeasonWithWorker: async ({ onProgress, signal, leagueId }) => {
      const state = await repository.load(leagueId)
      if (!state) {
        throw new Error('No league loaded')
      }
      if (state.phase === 'auction' || state.phase === 'preseason') {
        throw new Error('Season simulation is unavailable before regular season starts')
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
            await repository.save(message.payload.state, leagueId)
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
    advanceSeason: (leagueId?: string) => advanceSeason(repository, leagueId),
    exportSave: () => exportSave(repository),
    importSave: (raw: string) => importSave(repository, raw),
  }
}
