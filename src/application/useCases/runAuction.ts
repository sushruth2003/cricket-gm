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
    if (current.auction.complete) {
      return { nextState: current, result: current }
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

export const skipAuctionToPlayerForUser = async (
  repository: GameRepository,
  playerId: string,
  leagueId?: string,
): Promise<GameState> => {
  return repository.transaction(async (current) => {
    if (!current) {
      throw new Error('No league loaded')
    }
    if (current.phase !== 'auction' || current.auction.complete) {
      return { nextState: current, result: current }
    }

    const targetEntry = current.auction.entries.find((entry) => entry.playerId === playerId)
    if (!targetEntry || targetEntry.status !== 'pending') {
      throw new Error('Player is no longer available in the auction queue')
    }

    let next = structuredClone(current)
    const maxSteps = Math.max(1, next.auction.entries.length * 2)

    for (let step = 0; step < maxSteps; step += 1) {
      if (next.auction.currentPlayerId === playerId && next.auction.awaitingUserAction) {
        break
      }
      if (next.auction.complete) {
        break
      }
      const pendingTarget = next.auction.entries.find((entry) => entry.playerId === playerId)
      if (!pendingTarget || pendingTarget.status !== 'pending') {
        throw new Error('Player was sold or went unsold before your turn')
      }
      next = progressAuction(next, 'pass')
    }

    finalizeScheduleIfReady(next)
    next.metadata.updatedAt = new Date().toISOString()
    assertGameStateSemanticIntegrity(next)

    return { nextState: next, result: next }
  }, leagueId)
}
