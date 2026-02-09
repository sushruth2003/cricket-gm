import { progressAuction, runAutoAuction, type UserAuctionAction } from '@/domain/auction'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'
import { generateRoundRobinFixtures } from '@/domain/schedule'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

const finalizeScheduleIfReady = (next: GameState) => {
  if (!next.auction.complete) {
    return
  }
  next.fixtures = generateRoundRobinFixtures(next.teams, next.metadata.createdAt)
}

export const runAuction = async (repository: GameRepository, leagueId?: string): Promise<GameState> => {
  return repository.transaction(async (current) => {
    if (!current) {
      throw new Error('No league loaded')
    }

    const next = runAutoAuction(current)
    finalizeScheduleIfReady(next)
    next.metadata.updatedAt = new Date().toISOString()

    assertGameStateSemanticIntegrity(next)

    return { nextState: next, result: next }
  }, leagueId)
}

export const progressAuctionForUser = async (
  repository: GameRepository,
  userAction: UserAuctionAction,
  leagueId?: string,
): Promise<GameState> => {
  return repository.transaction(async (current) => {
    if (!current) {
      throw new Error('No league loaded')
    }

    const next = progressAuction(current, userAction)
    finalizeScheduleIfReady(next)
    next.metadata.updatedAt = new Date().toISOString()

    assertGameStateSemanticIntegrity(next)

    return { nextState: next, result: next }
  }, leagueId)
}
