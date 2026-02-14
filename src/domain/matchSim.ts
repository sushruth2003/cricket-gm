import { createPrng } from '@/domain/prng'
import type { GameState, InningsSummary, MatchResult, Player, PlayerBattingLine, PlayerBowlingLine, Team } from '@/domain/types'

const PHASE_MULTIPLIERS = [1.1, 0.9, 1.25] as const

const DISMISSAL_WEIGHTS: Array<{ kind: Exclude<PlayerBattingLine['dismissalKind'], null>; weight: number }> = [
  { kind: 'caught', weight: 56.5 },
  { kind: 'bowled', weight: 21.4 },
  { kind: 'lbw', weight: 9.0 },
  { kind: 'run-out', weight: 10.2 },
  { kind: 'caught-and-bowled', weight: 2.9 },
]

const getTeamPlayers = (players: Player[], team: Team) => {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const xiPlayers = team.playingXi.map((playerId) => playersById.get(playerId)).filter((player): player is Player => Boolean(player))

  if (xiPlayers.length >= 11) {
    return xiPlayers.slice(0, 11)
  }

  const fallbackPool = players.filter((player) => player.teamId === team.id && !team.playingXi.includes(player.id))
  return [...xiPlayers, ...fallbackPool].slice(0, 11)
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

const fieldingSuitability = (player: Player): number => {
  const catching = player.ratings.fielding.traits.catching
  const groundFielding = player.ratings.fielding.traits.groundFielding
  const wicketkeepingBonus = player.role === 'wicketkeeper' ? 10 : 0
  return Math.round(catching * 0.55 + groundFielding * 0.35 + wicketkeepingBonus)
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

const pickWeightedFielder = (
  prng: ReturnType<typeof createPrng>,
  bowlingPlayers: Player[],
  excludedPlayerIds: Set<string>,
  wicketkeeperPlayerId: string | null,
): Player | null => {
  const fielders = bowlingPlayers.filter((player) => !excludedPlayerIds.has(player.id))
  if (fielders.length === 0) {
    return null
  }

  const total = fielders.reduce((sum, player) => {
    const keeperBoost = player.id === wicketkeeperPlayerId ? 1.08 : 1
    return sum + fieldingSuitability(player) * keeperBoost
  }, 0)

  if (total <= 0) {
    return fielders[0]
  }

  let roll = prng.next() * total
  for (const player of fielders) {
    const keeperBoost = player.id === wicketkeeperPlayerId ? 1.08 : 1
    roll -= fieldingSuitability(player) * keeperBoost
    if (roll <= 0) {
      return player
    }
  }

  return fielders[fielders.length - 1]
}

const pickDismissalKind = (prng: ReturnType<typeof createPrng>): Exclude<PlayerBattingLine['dismissalKind'], null> => {
  const total = DISMISSAL_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = prng.next() * total

  for (const entry of DISMISSAL_WEIGHTS) {
    roll -= entry.weight
    if (roll <= 0) {
      return entry.kind
    }
  }

  return 'caught'
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
  const battingOrder = battingPlayers.map((player) => player.id)
  const lineByPlayerId = new Map<string, PlayerBattingLine>()
  const batting: PlayerBattingLine[] = []

  const ensureLine = (playerId: string): PlayerBattingLine => {
    const existing = lineByPlayerId.get(playerId)
    if (existing) {
      return existing
    }

    const next: PlayerBattingLine = {
      playerId,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      dismissalKind: null,
      dismissedByPlayerId: null,
      assistedByPlayerId: null,
    }
    lineByPlayerId.set(playerId, next)
    batting.push(next)
    return next
  }

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
  let strikerPlayerId = battingOrder[0] ?? null
  let nonStrikerPlayerId = battingOrder[1] ?? null
  let nextBatterIndex = 2

  if (strikerPlayerId) {
    ensureLine(strikerPlayerId)
  }
  if (nonStrikerPlayerId) {
    ensureLine(nonStrikerPlayerId)
  }

  const battingPlayerById = new Map(battingPlayers.map((player) => [player.id, player]))

  for (let over = 0; over < 20; over += 1) {
    if (!strikerPlayerId || wickets >= 10) {
      break
    }

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
      if (!strikerPlayerId || wickets >= 10) {
        break
      }

      const batterLine = ensureLine(strikerPlayerId)
      const batter = battingPlayerById.get(strikerPlayerId)
      if (!batter) {
        break
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

        let dismissalKind = pickDismissalKind(prng)
        if (dismissalKind === 'caught' && wickets >= 10) {
          dismissalKind = 'bowled'
        }

        batterLine.dismissalKind = dismissalKind

        if (dismissalKind === 'bowled' || dismissalKind === 'lbw' || dismissalKind === 'caught-and-bowled') {
          batterLine.dismissedByPlayerId = bowler.id
          bowlerLine.wickets += 1
        } else if (dismissalKind === 'caught') {
          const catcher = pickWeightedFielder(prng, bowlingPlayers, new Set([bowler.id]), wicketkeeperPlayerId)
          batterLine.dismissedByPlayerId = bowler.id
          batterLine.assistedByPlayerId = catcher?.id ?? wicketkeeperPlayerId
          bowlerLine.wickets += 1
        } else {
          const fielder = pickWeightedFielder(prng, bowlingPlayers, new Set(), wicketkeeperPlayerId)
          batterLine.dismissedByPlayerId = fielder?.id ?? wicketkeeperPlayerId ?? bowler.id
        }

        const nextBatterId = battingOrder[nextBatterIndex] ?? null
        nextBatterIndex += 1
        strikerPlayerId = nextBatterId
        if (strikerPlayerId) {
          ensureLine(strikerPlayerId)
        }
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
          const currentStriker = strikerPlayerId
          strikerPlayerId = nonStrikerPlayerId
          nonStrikerPlayerId = currentStriker
        }
      }

      balls += 1
      if (target && runs > target) {
        break
      }
    }

    bowlerLine.overs += 1

    if ((target && runs > target) || wickets >= 10 || !strikerPlayerId) {
      break
    }

    const endOverStriker = strikerPlayerId
    strikerPlayerId = nonStrikerPlayerId
    nonStrikerPlayerId = endOverStriker
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
