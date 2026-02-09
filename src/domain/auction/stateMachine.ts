import { canTeamBid } from '@/domain/auction/eligibility'
import { buildAuctionIndexes } from '@/domain/auction/indexes'
import { createRtmDecision, getBidIncrement } from '@/domain/auction/policyHooks'
import { assignPlayerToTeam, markLotSold, markLotUnsold, openNextLot } from '@/domain/auction/settlement'
import { resolveAuctionPolicy } from '@/domain/policy/resolver'
import { createPrng } from '@/domain/prng'
import type { AuctionPolicyContext, GameState, Player, ResolvedAuctionPolicy, Team } from '@/domain/types'

export type UserAuctionAction = 'bid' | 'pass' | 'auto'

const isBowlingOption = (player: Player): boolean => {
  return player.role === 'bowler' || player.role === 'allrounder' || player.ratings.bowling.overall >= 66
}

const teamRoleCounts = (team: Team, state: GameState, resolvedPolicy: ResolvedAuctionPolicy) => {
  const playerById = new Map(state.players.map((player) => [player.id, player]))
  const rosterPlayers = team.rosterPlayerIds.map((playerId) => playerById.get(playerId)).filter((player) => Boolean(player))
  const wicketkeeperCount = rosterPlayers.filter((player) => player?.role === 'wicketkeeper').length
  const bowlingOptions = rosterPlayers.filter((player) => player && isBowlingOption(player)).length
  const remainingSlots = Math.max(0, resolvedPolicy.policy.squadMax - team.rosterPlayerIds.length)
  return {
    wicketkeeperCount,
    bowlingOptions,
    remainingSlots,
  }
}

const playerValueScore = (player: Player): number => {
  const ratingsBlend =
    player.ratings.batting.overall * 0.34 +
    player.ratings.bowling.overall * 0.34 +
    player.ratings.fielding.overall * 0.14 +
    player.ratings.fitness * 0.09 +
    player.ratings.temperament * 0.09

  const roleMultiplier = player.role === 'allrounder' ? 1.08 : player.role === 'wicketkeeper' ? 1.03 : player.role === 'bowler' ? 1.01 : 0.97
  const battingSignal = player.lastSeasonStats.runs / 24 + player.lastSeasonStats.strikeRate / 8
  const bowlingSignal = player.lastSeasonStats.wickets * 3.8 + Math.max(0, 10 - player.lastSeasonStats.economy) * 4.8
  const seasonSignal =
    player.role === 'bowler'
      ? battingSignal * 0.2 + bowlingSignal * 1.1
      : player.role === 'allrounder'
        ? battingSignal * 0.6 + bowlingSignal * 0.8
        : player.role === 'wicketkeeper'
          ? battingSignal * 0.85 + bowlingSignal * 0.15
          : battingSignal * 1.05 + bowlingSignal * 0.1

  return ratingsBlend * roleMultiplier * 2.05 + seasonSignal
}

const teamNeedScore = (team: Team, player: Player, state: GameState, resolvedPolicy: ResolvedAuctionPolicy): number => {
  const counts = teamRoleCounts(team, state, resolvedPolicy)
  const remainingBowlingGap = Math.max(0, 5 - counts.bowlingOptions)
  const rosterUrgency = team.rosterPlayerIds.length < 18 ? 55 : team.rosterPlayerIds.length < 22 ? 32 : 14
  const wicketkeeperScarcityBoost = counts.wicketkeeperCount === 0 && player.role === 'wicketkeeper' ? 130 : 0
  const bowlingScarcityBoost = remainingBowlingGap > 0 && isBowlingOption(player) ? remainingBowlingGap * 27 : 0
  const allrounderFlexBoost = remainingBowlingGap > 0 && player.role === 'allrounder' ? 18 : 0
  const endgamePenalty = counts.remainingSlots <= 3 && !isBowlingOption(player) ? -18 : 0

  return rosterUrgency + wicketkeeperScarcityBoost + bowlingScarcityBoost + allrounderFlexBoost + endgamePenalty
}

const maxBidForTeam = (team: Team, player: Player, state: GameState, resolvedPolicy: ResolvedAuctionPolicy): number => {
  const counts = teamRoleCounts(team, state, resolvedPolicy)
  const baseValue = player.basePrice + playerValueScore(player) + teamNeedScore(team, player, state, resolvedPolicy)
  const reserveTarget = Math.max(1, counts.remainingSlots) * resolvedPolicy.policy.minimumPlayerBase
  const budgetRatio = team.budgetRemaining / reserveTarget
  const budgetPressureFactor = budgetRatio < 1 ? 0.72 : budgetRatio < 1.4 ? 0.82 : budgetRatio < 1.8 ? 0.9 : 0.98
  const endgameFactor = counts.remainingSlots <= 3 ? 0.9 : 1
  const cappedByBudget = Math.min(team.budgetRemaining, Math.round(baseValue * budgetPressureFactor * endgameFactor))
  return Math.max(0, cappedByBudget)
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
      const bidCeiling = maxBidForTeam(team, player, state, resolvedPolicy)
      const confidenceNoise = prng.nextInt(-6, 8)
      return { team, margin: bidCeiling - nextBid + confidenceNoise }
    })
    .filter(({ margin }) => margin >= 0)
    .sort((a, b) => b.margin - a.margin)

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

        const autoBidCeiling = maxBidForTeam(userTeam, player, nextState, resolvedPolicy)
        if (autoBidCeiling >= nextBid) {
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
