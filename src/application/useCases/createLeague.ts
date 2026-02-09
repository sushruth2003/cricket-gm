import { createSeededInitialStateWithOptions } from '@/domain/generator'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

export interface CreateLeagueOptions {
  leagueId?: string
  leagueName?: string
  policySet?: 'legacy-default' | 'ipl-2025-cycle'
  seasonYear?: number
}

export const createLeague = async (
  repository: GameRepository,
  seed = Date.now() % 1_000_000_000,
  options: CreateLeagueOptions = {},
): Promise<GameState> => {
  const seasonYear = options.seasonYear ?? new Date().getUTCFullYear()
  const seasonStartIso = `${seasonYear}-01-01T00:00:00.000Z`
  const policySet = options.policySet ?? 'ipl-2025-cycle'
  const state = createSeededInitialStateWithOptions(seed, {
    seasonStartIso,
    policyContext: {
      policySet,
      seasonYear,
    },
  })

  if (options.leagueId && options.leagueName) {
    await repository.createLeague(options.leagueId, options.leagueName, state)
  } else {
    await repository.save(state)
  }
  return state
}
