import { SimInvariantError, ValidationError } from '@/domain/errors'
import { policyContextFromState, resolveAuctionPolicy } from '@/domain/policy/resolver'
import type { GameState, MatchResult } from '@/domain/types'

export const assertTeamBudgets = (state: GameState) => {
  for (const team of state.teams) {
    if (team.budgetRemaining < 0) {
      throw new ValidationError(`Team ${team.name} exceeded budget`)
    }
  }
}

export const assertRosterSizes = (state: GameState) => {
  for (const team of state.teams) {
    if (state.auction.complete && team.rosterPlayerIds.length < state.config.minSquadSize) {
      throw new ValidationError(`Team ${team.name} below minimum squad size`)
    }
    if (team.rosterPlayerIds.length > state.config.maxSquadSize) {
      throw new ValidationError(`Team ${team.name} exceeds max squad size`)
    }
  }
}

export const assertOverseasCap = (state: GameState) => {
  const policy = resolveAuctionPolicy(policyContextFromState(state)).policy
  const playersById = new Map(state.players.map((player) => [player.id, player]))
  for (const team of state.teams) {
    const overseasCount = team.rosterPlayerIds.filter((playerId) => playersById.get(playerId)?.countryTag !== 'IN').length
    if (overseasCount > policy.overseasCap) {
      throw new ValidationError(`Team ${team.name} exceeds overseas player cap`)
    }
  }
}

export const assertMinimumSpend = (state: GameState) => {
  const policy = resolveAuctionPolicy(policyContextFromState(state)).policy
  if (!state.auction.complete) {
    return
  }
  for (const team of state.teams) {
    const spent = state.config.auctionBudget - team.budgetRemaining
    if (spent < policy.minimumSpend) {
      throw new ValidationError(`Team ${team.name} failed minimum spend requirement`)
    }
  }
}

export const assertScorecardIntegrity = (match: MatchResult) => {
  if (!match.innings) {
    return
  }

  for (const innings of match.innings) {
    if (innings.wickets > 10) {
      throw new SimInvariantError('Wickets cannot exceed 10', { matchId: match.id })
    }

    if (innings.overs < 0 || innings.overs > 20) {
      throw new SimInvariantError('Overs must be in [0, 20]', { matchId: match.id })
    }

    const battingRuns = innings.batting.reduce((sum, line) => sum + line.runs, 0)
    if (Math.abs(battingRuns - innings.runs) > 12) {
      throw new SimInvariantError('Innings and batting runs drift too much', {
        matchId: match.id,
        inningsRuns: innings.runs,
        battingRuns,
      })
    }
  }
}

export const assertGameStateSemanticIntegrity = (state: GameState) => {
  const playerIds = new Set(state.players.map((p) => p.id))

  for (const team of state.teams) {
    for (const playerId of team.rosterPlayerIds) {
      if (!playerIds.has(playerId)) {
        throw new ValidationError('Roster references unknown player', { teamId: team.id, playerId })
      }
    }
    if (team.wicketkeeperPlayerId && !team.playingXi.includes(team.wicketkeeperPlayerId)) {
      throw new ValidationError('Team wicketkeeper must be part of playing XI', {
        teamId: team.id,
        wicketkeeperPlayerId: team.wicketkeeperPlayerId,
      })
    }
  }

  assertTeamBudgets(state)
  assertRosterSizes(state)
  assertOverseasCap(state)
  assertMinimumSpend(state)

  for (const match of state.fixtures) {
    if (match.scheduledAt && Number.isNaN(Date.parse(match.scheduledAt))) {
      throw new ValidationError('Fixture scheduled date is invalid', { matchId: match.id, scheduledAt: match.scheduledAt })
    }
    assertScorecardIntegrity(match)
  }
}
