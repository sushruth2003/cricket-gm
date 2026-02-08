import { applyMatchToStats } from '@/domain/stats'
import { simulateMatch } from '@/domain/matchSim'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'
import type { GameState, MatchResult, Team } from '@/domain/types'

const updateStandings = (teams: Team[], match: MatchResult) => {
  if (!match.innings) {
    return
  }

  const home = teams.find((team) => team.id === match.homeTeamId)
  const away = teams.find((team) => team.id === match.awayTeamId)

  if (!home || !away) {
    return
  }

  const [homeInnings, awayInnings] = match.innings
  const homeNrrDelta = (homeInnings.runs - awayInnings.runs) / 20
  const awayNrrDelta = -homeNrrDelta

  home.netRunRate += homeNrrDelta
  away.netRunRate += awayNrrDelta

  if (!match.winnerTeamId) {
    home.points += 1
    away.points += 1
    home.ties += 1
    away.ties += 1
    return
  }

  const winner = match.winnerTeamId === home.id ? home : away
  const loser = match.winnerTeamId === home.id ? away : home

  winner.points += 2
  winner.wins += 1
  loser.losses += 1
}

export interface SimulateOneMatchResult {
  nextState: GameState
  playedMatch: MatchResult | null
}

export const simulateNextFixture = (state: GameState): SimulateOneMatchResult => {
  const fixtureIndex = state.fixtures.findIndex((fixture) => !fixture.played)
  if (fixtureIndex === -1) {
    return {
      nextState: { ...state, phase: 'complete' },
      playedMatch: null,
    }
  }

  const nextState = structuredClone(state)
  const fixture = nextState.fixtures[fixtureIndex]
  const playedMatch = simulateMatch(nextState, fixture, fixtureIndex + 1)

  nextState.fixtures[fixtureIndex] = playedMatch
  updateStandings(nextState.teams, playedMatch)
  applyMatchToStats(nextState, playedMatch)

  if (!nextState.fixtures.some((candidate) => !candidate.played)) {
    nextState.phase = 'complete'
  }

  nextState.metadata.updatedAt = new Date().toISOString()
  assertGameStateSemanticIntegrity(nextState)

  return {
    nextState,
    playedMatch,
  }
}
