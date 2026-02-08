import { ValidationError } from '@/domain/errors'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

export interface TeamSetupInput {
  playingXi: string[]
  wicketkeeperPlayerId: string
  bowlingPreset: 'balanced' | 'aggressive' | 'defensive'
}

export const updateUserTeamSetup = async (repository: GameRepository, input: TeamSetupInput): Promise<GameState> => {
  return repository.transaction(async (current) => {
    if (!current) {
      throw new ValidationError('No league loaded')
    }

    const next = structuredClone(current)
    const team = next.teams.find((candidate) => candidate.id === next.userTeamId)

    if (!team) {
      throw new ValidationError('User team not found')
    }

    const validIds = new Set(team.rosterPlayerIds)
    const filteredXi = input.playingXi.filter((playerId) => validIds.has(playerId)).slice(0, 11)
    if (filteredXi.length !== 11 && team.rosterPlayerIds.length >= 11) {
      throw new ValidationError('Playing XI must contain exactly 11 players')
    }
    if (!filteredXi.includes(input.wicketkeeperPlayerId)) {
      throw new ValidationError('Wicketkeeper must be part of the playing XI')
    }

    team.playingXi = filteredXi
    team.wicketkeeperPlayerId = input.wicketkeeperPlayerId
    team.bowlingPreset = input.bowlingPreset
    next.metadata.updatedAt = new Date().toISOString()

    return {
      nextState: next,
      result: next,
    }
  })
}
