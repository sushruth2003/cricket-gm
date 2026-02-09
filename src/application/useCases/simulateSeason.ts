import { applyMatchToStats } from '@/domain/stats'
import { simulateMatch } from '@/domain/matchSim'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'
import { ValidationError } from '@/domain/errors'
import { getFixtureDateKey, getRoundDateKey } from '@/domain/schedule'
import type { GameState, MatchResult, Team } from '@/domain/types'

const PLAYOFF_QUALIFIER_1_ID = 'playoff-qualifier-1'
const PLAYOFF_ELIMINATOR_ID = 'playoff-eliminator'
const PLAYOFF_QUALIFIER_2_ID = 'playoff-qualifier-2'
const PLAYOFF_FINAL_ID = 'playoff-final'

const isPlayoffFixture = (fixture: MatchResult): boolean => fixture.id.startsWith('playoff-')

const rankTeamsForPlayoffs = (teams: Team[]): Team[] => {
  return [...teams].sort(
    (a, b) =>
      b.points - a.points || b.netRunRate - a.netRunRate || b.wins - a.wins || a.shortName.localeCompare(b.shortName),
  )
}

const getMaxRound = (fixtures: MatchResult[]): number => {
  let maxRound = 0
  for (const fixture of fixtures) {
    maxRound = Math.max(maxRound, fixture.round)
  }
  return maxRound
}

const createFixture = (params: {
  id: string
  homeTeam: Team
  awayTeam: Team
  round: number
  seasonStartIso: string
}): MatchResult => {
  return {
    id: params.id,
    homeTeamId: params.homeTeam.id,
    awayTeamId: params.awayTeam.id,
    venue: `${params.homeTeam.city} Oval`,
    round: params.round,
    scheduledAt: getRoundDateKey(params.seasonStartIso, params.round),
    played: false,
    winnerTeamId: null,
    margin: '',
    innings: null,
  }
}

const getFixtureById = (fixtures: MatchResult[], id: string): MatchResult | undefined => {
  return fixtures.find((fixture) => fixture.id === id)
}

const getWinningTeamId = (fixture: MatchResult): string => {
  return fixture.winnerTeamId ?? fixture.homeTeamId
}

const getLosingTeamId = (fixture: MatchResult): string => {
  return getWinningTeamId(fixture) === fixture.homeTeamId ? fixture.awayTeamId : fixture.homeTeamId
}

const createInitialPlayoffFixtures = (state: GameState): boolean => {
  if (state.fixtures.some((fixture) => isPlayoffFixture(fixture))) {
    return false
  }

  const ranked = rankTeamsForPlayoffs(state.teams)
  if (ranked.length < 4) {
    return false
  }

  const baseRound = getMaxRound(state.fixtures) + 1
  state.fixtures.push(
    createFixture({
      id: PLAYOFF_QUALIFIER_1_ID,
      homeTeam: ranked[0],
      awayTeam: ranked[1],
      round: baseRound,
      seasonStartIso: state.metadata.createdAt,
    }),
    createFixture({
      id: PLAYOFF_ELIMINATOR_ID,
      homeTeam: ranked[2],
      awayTeam: ranked[3],
      round: baseRound,
      seasonStartIso: state.metadata.createdAt,
    }),
  )
  state.phase = 'playoffs'
  return true
}

const createQualifier2Fixture = (state: GameState): boolean => {
  if (getFixtureById(state.fixtures, PLAYOFF_QUALIFIER_2_ID)) {
    return false
  }

  const qualifier1 = getFixtureById(state.fixtures, PLAYOFF_QUALIFIER_1_ID)
  const eliminator = getFixtureById(state.fixtures, PLAYOFF_ELIMINATOR_ID)
  if (!qualifier1?.played || !eliminator?.played) {
    return false
  }

  const teamById = new Map(state.teams.map((team) => [team.id, team]))
  const qualifier1Loser = teamById.get(getLosingTeamId(qualifier1))
  const eliminatorWinner = teamById.get(getWinningTeamId(eliminator))
  if (!qualifier1Loser || !eliminatorWinner) {
    return false
  }

  const round = getMaxRound(state.fixtures) + 1
  state.fixtures.push(
    createFixture({
      id: PLAYOFF_QUALIFIER_2_ID,
      homeTeam: qualifier1Loser,
      awayTeam: eliminatorWinner,
      round,
      seasonStartIso: state.metadata.createdAt,
    }),
  )
  return true
}

const createFinalFixture = (state: GameState): boolean => {
  if (getFixtureById(state.fixtures, PLAYOFF_FINAL_ID)) {
    return false
  }

  const qualifier1 = getFixtureById(state.fixtures, PLAYOFF_QUALIFIER_1_ID)
  const qualifier2 = getFixtureById(state.fixtures, PLAYOFF_QUALIFIER_2_ID)
  if (!qualifier1?.played || !qualifier2?.played) {
    return false
  }

  const teamById = new Map(state.teams.map((team) => [team.id, team]))
  const qualifier1Winner = teamById.get(getWinningTeamId(qualifier1))
  const qualifier2Winner = teamById.get(getWinningTeamId(qualifier2))
  if (!qualifier1Winner || !qualifier2Winner) {
    return false
  }

  const round = getMaxRound(state.fixtures) + 1
  state.fixtures.push(
    createFixture({
      id: PLAYOFF_FINAL_ID,
      homeTeam: qualifier1Winner,
      awayTeam: qualifier2Winner,
      round,
      seasonStartIso: state.metadata.createdAt,
    }),
  )
  return true
}

const advanceTournamentIfNeeded = (state: GameState): boolean => {
  if (state.fixtures.some((fixture) => !fixture.played)) {
    return false
  }

  if (state.phase === 'regular-season') {
    return createInitialPlayoffFixtures(state)
  }

  if (state.phase === 'playoffs') {
    if (createQualifier2Fixture(state)) {
      return true
    }
    return createFinalFixture(state)
  }

  return false
}

const getNextScheduledDate = (state: GameState): string | null => {
  const pending = state.fixtures.filter((fixture) => !fixture.played)
  if (pending.length === 0) {
    return null
  }

  let nextDate = getFixtureDateKey(pending[0], state.metadata.createdAt)
  for (let index = 1; index < pending.length; index += 1) {
    const candidateDate = getFixtureDateKey(pending[index], state.metadata.createdAt)
    if (candidateDate < nextDate) {
      nextDate = candidateDate
    }
  }

  return nextDate
}

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
  playedMatches: MatchResult[]
  simulatedDate: string | null
}

export const simulateNextFixture = (state: GameState): SimulateOneMatchResult => {
  if (state.phase === 'auction' || state.phase === 'preseason') {
    throw new ValidationError('Season simulation is unavailable before regular season starts')
  }

  const nextState = structuredClone(state)
  advanceTournamentIfNeeded(nextState)
  const nextScheduledDate = getNextScheduledDate(nextState)
  if (!nextScheduledDate) {
    return {
      nextState: { ...nextState, phase: 'complete' },
      playedMatch: null,
      playedMatches: [],
      simulatedDate: null,
    }
  }

  const fixturesToPlay = nextState.fixtures
    .map((fixture, index) => ({ fixture, index }))
    .filter(({ fixture }) => !fixture.played && getFixtureDateKey(fixture, nextState.metadata.createdAt) === nextScheduledDate)
  const playedMatches: MatchResult[] = []

  for (const { fixture, index } of fixturesToPlay) {
    let playedMatch = simulateMatch(nextState, fixture, index + 1)
    if (isPlayoffFixture(playedMatch) && !playedMatch.winnerTeamId) {
      playedMatch = {
        ...playedMatch,
        winnerTeamId: playedMatch.homeTeamId,
        margin: 'Tie (home seed advances)',
      }
    }
    nextState.fixtures[index] = playedMatch
    if (!isPlayoffFixture(playedMatch)) {
      updateStandings(nextState.teams, playedMatch)
    }
    applyMatchToStats(nextState, playedMatch)
    playedMatches.push(playedMatch)
  }

  advanceTournamentIfNeeded(nextState)
  if (!nextState.fixtures.some((candidate) => !candidate.played)) {
    nextState.phase = 'complete'
  }

  nextState.metadata.updatedAt = new Date().toISOString()
  assertGameStateSemanticIntegrity(nextState)

  return {
    nextState,
    playedMatch: playedMatches.at(-1) ?? null,
    playedMatches,
    simulatedDate: nextScheduledDate,
  }
}
