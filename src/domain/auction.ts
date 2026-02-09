import { createRetentionState, createRtmDecision } from '@/domain/auction/policyHooks'
import { progressAuctionState, runAutoAuctionState, type UserAuctionAction } from '@/domain/auction/stateMachine'
import { resolveAuctionPolicy, resolveAuctionPolicyForSeason } from '@/domain/policy/resolver'
import type { AuctionPolicyContext, GameState, Team } from '@/domain/types'

export type { UserAuctionAction }

export const progressAuction = (state: GameState, userAction?: UserAuctionAction): GameState => {
  return progressAuctionState(state, userAction)
}

export const runAutoAuction = (state: GameState): GameState => {
  return runAutoAuctionState(state)
}

export const progressAuctionWithPolicyContext = (
  state: GameState,
  userAction: UserAuctionAction | undefined,
  policyContext: AuctionPolicyContext,
): GameState => {
  return progressAuctionState(state, userAction, policyContext)
}

export const runAutoAuctionWithPolicyContext = (state: GameState, policyContext: AuctionPolicyContext): GameState => {
  return runAutoAuctionState(state, policyContext)
}

export const resolveAuctionPolicyForContext = (policyContext: AuctionPolicyContext = {}) => {
  return resolveAuctionPolicyForSeason(policyContext)
}

export const createRetentionStateForContext = (policyContext: AuctionPolicyContext = {}) => {
  return createRetentionState(resolveAuctionPolicy(policyContext))
}

export const createRtmDecisionForContext = (
  winner: Team,
  finalBid: number,
  incumbentTeamId: string | null,
  policyContext: AuctionPolicyContext = {},
) => {
  return createRtmDecision(resolveAuctionPolicy(policyContext), winner, finalBid, incumbentTeamId)
}
