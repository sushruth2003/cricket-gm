import { SimInvariantError, ValidationError } from '@/domain/errors'
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
    if (team.rosterPlayerIds.length > state.config.maxSquadSize) {
      throw new ValidationError(`Team ${team.name} exceeds max squad size`)
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

  for (const match of state.fixtures) {
    assertScorecardIntegrity(match)
  }
}
