import { canTeamBid } from '@/domain/auction/eligibility'
import { buildAuctionIndexes } from '@/domain/auction/indexes'
import { createRtmDecision, getBidIncrement } from '@/domain/auction/policyHooks'
import { assignPlayerToTeam, markLotSold, markLotUnsold, openNextLot } from '@/domain/auction/settlement'
import { resolveAuctionPolicy } from '@/domain/policy/resolver'
import { createPrng } from '@/domain/prng'
import type { AuctionPolicyContext, GameState, Player, ResolvedAuctionPolicy, Team } from '@/domain/types'

export type UserAuctionAction = 'bid' | 'pass' | 'auto'

const playerOverall = (player: Player) =>
  Math.round((player.ratings.batting.overall + player.ratings.bowling.overall + player.ratings.fielding.overall) / 3)

const teamIntentValue = (team: Team, player: Player, state: GameState) => {
  const needFactor = team.rosterPlayerIds.length < 18 ? 160 : team.rosterPlayerIds.length < 22 ? 75 : 25
  const balanceBoost =
    player.role === 'wicketkeeper' && !team.rosterPlayerIds.some((playerId) => state.players.find((p) => p.id === playerId)?.role === 'wicketkeeper')
      ? 60
      : 0
  return player.basePrice + playerOverall(player) * 2 + needFactor + balanceBoost
}

const chooseAiBidder = (state: GameState, player: Player, nextBid: number, resolvedPolicy: ResolvedAuctionPolicy): Team | null => {
  const indexes = buildAuctionIndexes(state)
  const seed =
    state.metadata.seed +
    state.auction.currentNominationIndex * 97 +
    state.auction.currentBid * 13 +
    state.auction.passedTeamIds.length * 7
  const prng = createPrng(seed)

  const candidates = state.teams
    .filter((team) => team.id !== state.userTeamId)
    .filter((team) => team.id !== state.auction.currentBidTeamId)
    .filter((team) => !state.auction.passedTeamIds.includes(team.id))
    .filter((team) => canTeamBid(state, indexes, team, player, nextBid, resolvedPolicy.policy))
    .map((team) => {
      const value = teamIntentValue(team, player, state) + prng.nextInt(0, 35)
      return { team, value }
    })
    .filter(({ value }) => value >= nextBid)
    .sort((a, b) => b.value - a.value)

  return candidates[0]?.team ?? null
}

const applyBid = (state: GameState, teamId: string, bid: number) => {
  state.auction.currentBid = bid
  state.auction.currentBidTeamId = teamId
  state.auction.message = `${teamId} bids ${bid}L`
}

const userCanBid = (state: GameState, player: Player, nextBid: number, resolvedPolicy: ResolvedAuctionPolicy): boolean => {
  const userTeam = state.teams.find((team) => team.id === state.userTeamId)
  if (!userTeam) {
    return false
  }
  if (state.auction.currentBidTeamId === userTeam.id) {
    return false
  }
  if (state.auction.passedTeamIds.includes(userTeam.id)) {
    return false
  }

  const indexes = buildAuctionIndexes(state)
  return canTeamBid(state, indexes, userTeam, player, nextBid, resolvedPolicy.policy)
}

const settleLotIfDone = (state: GameState, player: Player, nextBid: number, resolvedPolicy: ResolvedAuctionPolicy): boolean => {
  const userActive = userCanBid(state, player, nextBid, resolvedPolicy)
  const aiBidder = chooseAiBidder(state, player, nextBid, resolvedPolicy)

  if (userActive || aiBidder) {
    return false
  }

  const indexes = buildAuctionIndexes(state)
  const entry = indexes.entryByPlayerId.get(player.id)
  if (!entry) {
    state.auction.currentPlayerId = null
    return true
  }

  if (!state.auction.currentBidTeamId) {
    state.auction.message = `${player.firstName} ${player.lastName} goes unsold`
    markLotUnsold(state, entry)
    return true
  }

  const winner = indexes.teamById.get(state.auction.currentBidTeamId)
  if (!winner) {
    markLotUnsold(state, entry)
    return true
  }

  const incumbentTeamId = player.teamId
  assignPlayerToTeam(indexes, player, winner, state.auction.currentBid)
  createRtmDecision(resolvedPolicy, winner, state.auction.currentBid, incumbentTeamId)
  state.auction.message = `${player.firstName} ${player.lastName} sold to ${winner.shortName} for ${state.auction.currentBid}L`

  markLotSold(state, entry, winner, state.auction.currentBid)
  return true
}

export const progressAuctionState = (state: GameState, userAction?: UserAuctionAction, policyContext: AuctionPolicyContext = {}): GameState => {
  const nextState: GameState = structuredClone(state)
  const autoMode = userAction === 'auto'

  if (nextState.phase !== 'auction' || nextState.auction.complete) {
    return nextState
  }

  const resolvedPolicy = resolveAuctionPolicy(policyContext)
  let pendingAction = userAction

  while (!nextState.auction.complete) {
    if (!nextState.auction.currentPlayerId) {
      const indexes = buildAuctionIndexes(nextState)
      openNextLot(nextState, indexes, resolvedPolicy.policy)
      if (nextState.auction.complete) {
        return nextState
      }
    }

    const player = nextState.players.find((candidate) => candidate.id === nextState.auction.currentPlayerId)
    if (!player) {
      nextState.auction.currentPlayerId = null
      continue
    }

    const increment =
      nextState.auction.currentBid === 0
        ? player.basePrice
        : getBidIncrement(nextState.auction.currentBid, nextState.auction.phase, resolvedPolicy.policy)

    const nextBid = nextState.auction.currentBid === 0 ? player.basePrice : nextState.auction.currentBid + increment
    nextState.auction.currentBidIncrement = increment

    if (pendingAction === 'pass') {
      if (!nextState.auction.passedTeamIds.includes(nextState.userTeamId)) {
        nextState.auction.passedTeamIds.push(nextState.userTeamId)
      }
      pendingAction = undefined
    } else if (pendingAction === 'bid') {
      if (userCanBid(nextState, player, nextBid, resolvedPolicy)) {
        applyBid(nextState, nextState.userTeamId, nextBid)
      }
      pendingAction = undefined
    }

    const settledImmediately = settleLotIfDone(nextState, player, nextBid, resolvedPolicy)
    if (settledImmediately) {
      continue
    }

    const canUserAct = userCanBid(nextState, player, nextBid, resolvedPolicy)
    if (canUserAct) {
      if (autoMode) {
        const userTeam = nextState.teams.find((team) => team.id === nextState.userTeamId)
        if (!userTeam) {
          nextState.auction.passedTeamIds.push(nextState.userTeamId)
          continue
        }

        const autoValue = teamIntentValue(userTeam, player, nextState)
        if (autoValue >= nextBid) {
          applyBid(nextState, nextState.userTeamId, nextBid)
        } else if (!nextState.auction.passedTeamIds.includes(nextState.userTeamId)) {
          nextState.auction.passedTeamIds.push(nextState.userTeamId)
        }

        const resolvedAfterAutoUser = settleLotIfDone(nextState, player, nextBid, resolvedPolicy)
        if (resolvedAfterAutoUser) {
          continue
        }
      } else {
        nextState.auction.awaitingUserAction = true
        nextState.auction.message = `${player.firstName} ${player.lastName}: your move at ${nextBid}L`
        return nextState
      }
    }

    const aiTeam = chooseAiBidder(nextState, player, nextBid, resolvedPolicy)
    if (!aiTeam) {
      settleLotIfDone(nextState, player, nextBid, resolvedPolicy)
      continue
    }

    applyBid(nextState, aiTeam.id, nextBid)

    const resolvedAfterAi = settleLotIfDone(nextState, player, nextBid, resolvedPolicy)
    if (resolvedAfterAi) {
      continue
    }
  }

  return nextState
}

export const runAutoAuctionState = (state: GameState, policyContext: AuctionPolicyContext = {}): GameState => {
  return progressAuctionState(state, 'auto', policyContext)
}
