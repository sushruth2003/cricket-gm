import { createPrng } from '@/domain/prng'
import type { GameState, InningsSummary, MatchResult, Player, PlayerBattingLine, PlayerBowlingLine, Team } from '@/domain/types'

const PHASE_MULTIPLIERS = [1.1, 0.9, 1.25] as const

const getTeamPlayers = (players: Player[], team: Team) => {
  const roster = players.filter((player) => team.playingXi.includes(player.id))
  return roster.length >= 11 ? roster.slice(0, 11) : players.filter((player) => player.teamId === team.id).slice(0, 11)
}

const bowlingSuitability = (player: Player): number => {
  const base = player.ratings.bowling.overall
  if (player.role === 'bowler') {
    return base + 8
  }
  if (player.role === 'allrounder') {
    return base + 5
  }
  if (player.role === 'wicketkeeper') {
    return base - 4
  }
  return base - 6
}

const getBowlingUnit = (players: Player[]): Player[] => {
  const sorted = [...players].sort((a, b) => bowlingSuitability(b) - bowlingSuitability(a))
  return sorted.slice(0, 5)
}

const resolveWicketkeeper = (team: Team, players: Player[]): string | null => {
  if (team.wicketkeeperPlayerId && players.some((player) => player.id === team.wicketkeeperPlayerId)) {
    return team.wicketkeeperPlayerId
  }
  const designated = players.find((player) => player.role === 'wicketkeeper')
  return designated?.id ?? players[0]?.id ?? null
}

const simulateInnings = (
  battingTeam: Team,
  bowlingTeam: Team,
  battingPlayers: Player[],
  bowlingPlayers: Player[],
  seed: number,
  target?: number,
): InningsSummary => {
  const prng = createPrng(seed)
  const batting: PlayerBattingLine[] = battingPlayers.map((player) => ({
    playerId: player.id,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
  }))

  const bowlingUnit = getBowlingUnit(bowlingPlayers)
  const wicketkeeperPlayerId = resolveWicketkeeper(bowlingTeam, bowlingPlayers)

  const bowling: PlayerBowlingLine[] = bowlingUnit.map((player) => ({
    playerId: player.id,
    overs: 0,
    runsConceded: 0,
    wickets: 0,
  }))

  let runs = 0
  let wickets = 0
  let balls = 0
  let striker = 0

  for (let over = 0; over < 20; over += 1) {
    const phase = over < 6 ? 0 : over < 15 ? 1 : 2
    const phaseMultiplier = PHASE_MULTIPLIERS[phase]
    const bowlerLine = bowling[over % bowlingUnit.length]
    const bowler = bowlingUnit[over % bowlingUnit.length]
    const bowlingStrength = Math.round(
      bowler.ratings.bowling.overall * 0.55 +
        bowler.ratings.bowling.traits.accuracy * 0.2 +
        bowler.ratings.bowling.traits.control * 0.15 +
        bowler.ratings.bowling.traits.variations * 0.1,
    )

    for (let ball = 0; ball < 6; ball += 1) {
      if (wickets >= 10) {
        break
      }

      const batterLine = batting[striker]
      const batter = battingPlayers.find((player) => player.id === batterLine.playerId)
      if (!batter) {
        continue
      }

      const battingStrength = Math.round(
        batter.ratings.batting.overall * 0.5 +
          batter.ratings.batting.traits.timing * 0.2 +
          batter.ratings.batting.traits.power * 0.2 +
          batter.ratings.batting.traits.composure * 0.1,
      )

      const scoringBias = (battingStrength - bowlingStrength) / 22
      const wicketChance = Math.max(0.04, 0.12 - scoringBias * 0.01)

      if (prng.next() < wicketChance) {
        wickets += 1
        batterLine.out = true
        batterLine.balls += 1
        bowlerLine.wickets += 1
        striker = Math.min(striker + 1, batting.length - 1)
      } else {
        const baseRuns = Math.max(0, Math.round(prng.nextInt(0, 6) * phaseMultiplier + scoringBias))
        const runOutcome = Math.min(baseRuns, 6)
        runs += runOutcome
        batterLine.runs += runOutcome
        batterLine.balls += 1
        bowlerLine.runsConceded += runOutcome

        if (runOutcome === 4) {
          batterLine.fours += 1
        }
        if (runOutcome === 6) {
          batterLine.sixes += 1
        }

        if (runOutcome % 2 === 1) {
          striker = Math.min(striker + 1, batting.length - 1)
        }
      }

      balls += 1
      if (target && runs > target) {
        break
      }
    }

    bowlerLine.overs += 1

    if ((target && runs > target) || wickets >= 10) {
      break
    }
  }

  return {
    battingTeamId: battingTeam.id,
    bowlingTeamId: bowlingTeam.id,
    wicketkeeperPlayerId,
    runs,
    wickets,
    overs: Number((balls / 6).toFixed(1)),
    batting,
    bowling,
  }
}

export const simulateMatch = (state: GameState, match: MatchResult, seedOffset: number): MatchResult => {
  const homeTeam = state.teams.find((team) => team.id === match.homeTeamId)
  const awayTeam = state.teams.find((team) => team.id === match.awayTeamId)

  if (!homeTeam || !awayTeam) {
    return match
  }

  const homePlayers = getTeamPlayers(state.players, homeTeam)
  const awayPlayers = getTeamPlayers(state.players, awayTeam)

  const first = simulateInnings(homeTeam, awayTeam, homePlayers, awayPlayers, state.metadata.seed + seedOffset)
  const second = simulateInnings(awayTeam, homeTeam, awayPlayers, homePlayers, state.metadata.seed + seedOffset + 9_999, first.runs)

  let winnerTeamId: string | null = null
  let margin = 'Tie'

  if (first.runs > second.runs) {
    winnerTeamId = homeTeam.id
    margin = `${first.runs - second.runs} runs`
  } else if (second.runs > first.runs) {
    winnerTeamId = awayTeam.id
    margin = `${10 - second.wickets} wickets`
  }

  return {
    ...match,
    played: true,
    winnerTeamId,
    margin,
    innings: [first, second],
  }
}
